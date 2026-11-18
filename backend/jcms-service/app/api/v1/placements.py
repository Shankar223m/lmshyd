from datetime import date

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel
from sqlalchemy import func, select

from app.api.deps import CurrentUser, DbSession, attach_request_id, require_roles
from app.core.exceptions import AppError
from app.core.responses import success_data
from app.models.entities import Application, Job, Offer, Organization, Placement, PlacementEvidence, StudentProfile, User
from app.modules.audit.service import record_audit
from app.modules.notifications.service import notify_user
from app.shared.enums import JobStatus, PlacementStatus, UserRole

router = APIRouter(tags=["placements"])


class PlacementSubmitBody(BaseModel):
    designation: str
    joining_date: str | None = None
    annual_package: float | None = None
    work_location: str | None = None
    evidence_file_id: str | None = None


class VerifyBody(BaseModel):
    action: str
    comment: str | None = None


@router.get("/placements/me")
def my_placement(db: DbSession, user: CurrentUser, request: Request, _: str = Depends(attach_request_id)):
    require_roles(UserRole.STUDENT)(user)
    p = db.scalar(
        select(Placement).where(Placement.student_id == user.id).order_by(Placement.created_at.desc())
    )
    if not p:
        return success_data(None, request)

    offer = db.get(Offer, p.offer_id) if p.offer_id else None
    app = db.get(Application, p.application_id) if p.application_id else None
    job = db.get(Job, app.job_id) if app else None
    org = db.get(Organization, job.organization_id) if job else None

    # Institution placement officer info
    inst_officer = None
    if p.institution_id:
        officer = db.scalar(
            select(User).where(User.organization_id == p.institution_id, User.role == UserRole.INSTITUTION.value)
        )
        if officer:
            inst = db.get(Organization, p.institution_id)
            inst_officer = {
                "name": officer.full_name,
                "email": officer.email,
                "institution_name": inst.name if inst else None,
            }

    return success_data(
        {
            "id": p.id,
            "status": p.status,
            "company_name": org.name if org else None,
            "designation": p.designation or (offer.role_title if offer else None),
            "joining_date": p.joining_date.isoformat() if p.joining_date else (offer.joining_date.isoformat() if offer and offer.joining_date else None),
            "annual_package": float(p.annual_package) if p.annual_package else (float(offer.annual_package) if offer else None),
            "work_location": p.work_location or (offer.location if offer else None),
            "evidence_file_id": p.evidence_file_id,
            "evidence_documents": [
                {
                    "id": d.id,
                    "file_id": d.file_id,
                    "category": d.category,
                    "status": d.status,
                }
                for d in db.scalars(select(PlacementEvidence).where(PlacementEvidence.placement_id == p.id)).all()
            ],
            "verifier_comment": p.verifier_comment,
            "placement_officer": inst_officer,
        },
        request,
    )


class PlacementEvidenceAddBody(BaseModel):
    file_id: str
    category: str


class EvidenceReviewBody(BaseModel):
    action: str
    rejection_reason: str | None = None


@router.get("/placements/{placement_id}/evidence")
def list_evidence(
    placement_id: str, db: DbSession, user: CurrentUser, request: Request, _: str = Depends(attach_request_id)
):
    p = db.get(Placement, placement_id)
    if not p:
        raise AppError("NOT_FOUND", "Not found", 404)
    if user.role == UserRole.STUDENT.value and p.student_id != user.id:
        raise AppError("FORBIDDEN", "Forbidden", 403)
    if user.role == UserRole.INSTITUTION.value and p.institution_id != user.organization_id:
        raise AppError("FORBIDDEN", "Forbidden", 403)
    docs = db.scalars(select(PlacementEvidence).where(PlacementEvidence.placement_id == p.id)).all()
    return success_data(
        [
            {
                "id": d.id,
                "file_id": d.file_id,
                "category": d.category,
                "status": d.status,
                "rejection_reason": d.rejection_reason,
                "created_at": d.created_at.isoformat() if d.created_at else None,
            }
            for d in docs
        ],
        request,
    )


@router.post("/placements/{placement_id}/evidence/documents")
def add_evidence_document(
    placement_id: str,
    body: PlacementEvidenceAddBody,
    db: DbSession,
    user: CurrentUser,
    request: Request,
    _: str = Depends(attach_request_id),
):
    require_roles(UserRole.STUDENT)(user)
    p = db.get(Placement, placement_id)
    if not p or p.student_id != user.id:
        raise AppError("FORBIDDEN", "Forbidden", 403)
    doc = PlacementEvidence(
        placement_id=p.id,
        file_id=body.file_id,
        category=body.category,
        status="PENDING",
    )
    db.add(doc)
    if not p.evidence_file_id:
        p.evidence_file_id = body.file_id
    p.status = PlacementStatus.PENDING_VERIFICATION.value
    db.commit()
    return success_data({"id": doc.id, "status": doc.status}, request)


@router.post("/placements/{placement_id}/evidence/{evidence_id}/review")
def review_evidence(
    placement_id: str,
    evidence_id: str,
    body: EvidenceReviewBody,
    db: DbSession,
    user: CurrentUser,
    request: Request,
    _: str = Depends(attach_request_id),
):
    require_roles(UserRole.INSTITUTION)(user)
    p = db.get(Placement, placement_id)
    if not p or p.institution_id != user.organization_id:
        raise AppError("FORBIDDEN", "Forbidden", 403)
    doc = db.get(PlacementEvidence, evidence_id)
    if not doc or doc.placement_id != p.id:
        raise AppError("NOT_FOUND", "Not found", 404)
    if body.action == "approve":
        doc.status = "APPROVED"
    elif body.action == "reject":
        doc.status = "REJECTED"
        doc.rejection_reason = body.rejection_reason
    else:
        raise AppError("INVALID_ACTION", "Invalid action", 400)
    doc.reviewed_by = user.id
    p = db.get(Placement, placement_id)
    if p:
        notify_user(
            db,
            user_id=p.student_id,
            title="Placement evidence reviewed",
            body=f"Document {doc.category} was {doc.status.lower()}."
            + (f" Reason: {body.rejection_reason}" if body.rejection_reason else ""),
            resource_type="placement",
            resource_id=p.id,
        )
    record_audit(
        db,
        actor_id=user.id,
        action=f"placement.evidence.{body.action}",
        resource_type="placement_evidence",
        resource_id=doc.id,
        metadata={"placement_id": placement_id, "category": doc.category},
    )
    db.commit()
    return success_data({"status": doc.status}, request)


@router.post("/placements/{placement_id}/evidence")
def submit_placement(
    placement_id: str,
    body: PlacementSubmitBody,
    db: DbSession,
    user: CurrentUser,
    request: Request,
    _: str = Depends(attach_request_id),
):
    p = db.get(Placement, placement_id)
    if not p or p.student_id != user.id:
        raise AppError("FORBIDDEN", "Forbidden", 403)
    p.designation = body.designation
    p.work_location = body.work_location
    if body.annual_package is not None:
        p.annual_package = body.annual_package
    p.evidence_file_id = body.evidence_file_id
    if body.joining_date:
        p.joining_date = date.fromisoformat(body.joining_date)
    p.status = PlacementStatus.PENDING_VERIFICATION.value

    # Notify institution placement officer
    if p.institution_id:
        officer = db.scalar(
            select(User).where(User.organization_id == p.institution_id, User.role == UserRole.INSTITUTION.value)
        )
        if officer:
            notify_user(
                db,
                user_id=officer.id,
                title="Placement verification request",
                body=f"Student {user.full_name} submitted placement details for verification.",
                resource_type="placement",
                resource_id=p.id,
            )

    record_audit(
        db,
        actor_id=user.id,
        action="placement.submit_evidence",
        resource_type="placement",
        resource_id=p.id,
    )
    db.commit()
    return success_data({"status": p.status}, request)


@router.get("/institutions/me/placements")
def institution_placements(
    db: DbSession,
    user: CurrentUser,
    request: Request,
    status: str | None = None,
    _: str = Depends(attach_request_id),
):
    require_roles(UserRole.INSTITUTION)(user)
    if not user.organization_id:
        raise AppError("FORBIDDEN", "No institution", 403)

    query = select(Placement).where(Placement.institution_id == user.organization_id)
    if status and status != "ALL":
        query = query.where(Placement.status == status)

    placements = db.scalars(query.order_by(Placement.created_at.desc())).all()

    total_students = db.scalar(
        select(func.count(User.id))
        .outerjoin(StudentProfile, StudentProfile.user_id == User.id)
        .where(
            (User.organization_id == user.organization_id)
            | (StudentProfile.institution_id == user.organization_id),
            User.role == UserRole.STUDENT.value,
        )
    ) or 0

    placed = db.scalar(
        select(func.count(Placement.id)).where(
            Placement.institution_id == user.organization_id,
            Placement.status == PlacementStatus.VERIFIED.value,
        )
    ) or 0

    to_verify = db.scalar(
        select(func.count(Placement.id)).where(
            Placement.institution_id == user.organization_id,
            Placement.status == PlacementStatus.PENDING_VERIFICATION.value,
        )
    ) or 0

    active_drives = db.scalar(
        select(func.count(Job.id)).where(Job.status == JobStatus.PUBLISHED.value)
    ) or 0

    out = []
    for p in placements:
        student = db.get(User, p.student_id)
        profile = student.student_profile if student else None
        offer = db.get(Offer, p.offer_id) if p.offer_id else None
        app = db.get(Application, p.application_id) if p.application_id else None
        job = db.get(Job, app.job_id) if app else None
        org = db.get(Organization, job.organization_id) if job else None

        evidence_docs = db.scalars(
            select(PlacementEvidence).where(PlacementEvidence.placement_id == p.id)
        ).all()
        out.append(
            {
                "id": p.id,
                "student_id": p.student_id,
                "student_name": student.full_name if student else None,
                "student_email": student.email if student else None,
                "program": profile.program if profile else None,
                "cgpa": float(profile.cgpa) if profile and profile.cgpa else None,
                "graduation_year": profile.graduation_year if profile else None,
                "company_name": org.name if org else None,
                "designation": p.designation or (offer.role_title if offer else None),
                "annual_package": float(p.annual_package) if p.annual_package else (float(offer.annual_package) if offer else None),
                "work_location": p.work_location or (offer.location if offer else None),
                "joining_date": p.joining_date.isoformat() if p.joining_date else None,
                "evidence_file_id": p.evidence_file_id,
                "evidence_documents": [
                    {
                        "id": d.id,
                        "file_id": d.file_id,
                        "category": d.category,
                        "status": d.status,
                        "rejection_reason": d.rejection_reason,
                    }
                    for d in evidence_docs
                ],
                "status": p.status,
                "verifier_comment": p.verifier_comment,
                "submitted_at": p.updated_at.isoformat() if p.updated_at else None,
            }
        )

    placed_percent = int((placed / total_students * 100)) if total_students else 0

    return success_data(
        {
            "stats": {
                "students": total_students,
                "placed": placed,
                "placed_percent": placed_percent,
                "active_drives": active_drives,
                "to_verify": to_verify,
            },
            "placements": out,
        },
        request,
    )


@router.post("/institutions/me/placements/{placement_id}/verify")
def verify_placement(
    placement_id: str,
    body: VerifyBody,
    db: DbSession,
    user: CurrentUser,
    request: Request,
    _: str = Depends(attach_request_id),
):
    require_roles(UserRole.INSTITUTION)(user)
    p = db.get(Placement, placement_id)
    if not p or p.institution_id != user.organization_id:
        raise AppError("FORBIDDEN", "Forbidden", 403)
    if body.action == "verify":
        p.status = PlacementStatus.VERIFIED.value
    elif body.action == "reject":
        p.status = PlacementStatus.REJECTED.value
    elif body.action in ("request_review", "ask_details"):
        p.status = PlacementStatus.NEEDS_REVIEW.value
    else:
        raise AppError("INVALID_ACTION", "Invalid action", 400)
    p.verifier_comment = body.comment

    notify_user(
        db,
        user_id=p.student_id,
        title="Placement status updated",
        body=f"Your placement verification status is now {p.status}." + (f" Note: {body.comment}" if body.comment else ""),
        resource_type="placement",
        resource_id=p.id,
    )

    record_audit(
        db,
        actor_id=user.id,
        action=f"placement.{body.action}",
        resource_type="placement",
        resource_id=p.id,
        metadata={"comment": body.comment},
    )
    db.commit()
    return success_data({"status": p.status, "comment": p.verifier_comment}, request)
