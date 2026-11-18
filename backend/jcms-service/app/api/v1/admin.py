from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel
from sqlalchemy import func, select

from app.api.deps import CurrentUser, DbSession, attach_request_id, require_roles
from app.core.exceptions import AppError
from app.core.responses import success_data
from app.models.entities import AuditEvent, Application, Job, Offer, Organization, Placement, User
from app.modules.jobs import service as job_service
from app.modules.organizations import service as org_service
from app.shared.enums import JobStatus, OrganizationType, UserRole, VerificationStatus

router = APIRouter(prefix="/admin", tags=["admin"])


class ModerationBody(BaseModel):
    action: str
    note: str | None = None


class VerifyOrgBody(BaseModel):
    action: str
    comment: str | None = None


@router.get("/organizations")
def list_organizations(
    db: DbSession,
    user: CurrentUser,
    request: Request,
    org_type: str | None = None,
    status: str | None = None,
    _: str = Depends(attach_request_id),
):
    require_roles(UserRole.PLATFORM_ADMINISTRATOR)(user)
    stmt = select(Organization)
    if org_type and org_type.upper() != "ALL":
        stmt = stmt.where(Organization.org_type == org_type.upper())
    if status and status.upper() != "ALL":
        stmt = stmt.where(Organization.verification_status == status.upper())
    stmt = stmt.order_by(Organization.created_at.desc())
    orgs = db.scalars(stmt).all()
    return success_data(
        [
            {
                "id": o.id,
                "name": o.name,
                "org_type": o.org_type,
                "verification_status": o.verification_status,
                "verification_comment": o.verification_comment,
                "registration_number": o.registration_number,
                "website": o.website,
                "contact_name": o.contact_name,
                "contact_email": o.contact_email,
                "size_band": o.size_band,
                "created_at": o.created_at.isoformat() if o.created_at else None,
            }
            for o in orgs
        ],
        request,
    )


@router.get("/organizations/pending")
def pending_orgs(db: DbSession, user: CurrentUser, request: Request, _: str = Depends(attach_request_id)):
    require_roles(UserRole.PLATFORM_ADMINISTRATOR)(user)
    orgs = db.scalars(
        select(Organization).where(
            Organization.verification_status.in_(
                [
                    VerificationStatus.PENDING.value,
                    VerificationStatus.UNDER_REVIEW.value,
                    VerificationStatus.CHANGES_REQUIRED.value,
                ]
            )
        ).order_by(Organization.created_at.desc())
    ).all()
    return success_data(
        [
            {
                "id": o.id,
                "name": o.name,
                "org_type": o.org_type,
                "verification_status": o.verification_status,
                "verification_comment": o.verification_comment,
                "registration_number": o.registration_number,
                "website": o.website,
                "contact_name": o.contact_name,
                "contact_email": o.contact_email,
                "size_band": o.size_band,
            }
            for o in orgs
        ],
        request,
    )


@router.post("/organizations/{organization_id}/verify")
def verify_org(
    organization_id: str,
    body: VerifyOrgBody,
    db: DbSession,
    user: CurrentUser,
    request: Request,
    _: str = Depends(attach_request_id),
):
    require_roles(UserRole.PLATFORM_ADMINISTRATOR)(user)
    org = db.get(Organization, organization_id)
    if not org:
        raise AppError("NOT_FOUND", "Organization not found", 404)
    try:
        org_service.verify_organization(db, org, user, body.action, body.comment)
        db.commit()
    except ValueError as e:
        db.rollback()
        raise AppError(str(e), str(e), 403)
    return success_data({"verification_status": org.verification_status, "comment": org.verification_comment}, request)


@router.get("/jobs")
def list_admin_jobs(
    db: DbSession,
    user: CurrentUser,
    request: Request,
    tab: str | None = None,
    _: str = Depends(attach_request_id),
):
    require_roles(UserRole.PLATFORM_ADMINISTRATOR)(user)
    stmt = select(Job)
    if tab == "queue":
        stmt = stmt.where(Job.status.in_([JobStatus.UNDER_REVIEW.value, JobStatus.SUBMITTED.value]))
    elif tab == "decided":
        stmt = stmt.where(Job.status.in_([JobStatus.PUBLISHED.value, JobStatus.REJECTED.value, JobStatus.CHANGES_REQUIRED.value]))
    elif tab == "flagged":
        stmt = stmt.where(Job.status.in_([JobStatus.CHANGES_REQUIRED.value, JobStatus.PAUSED.value]))

    jobs = db.scalars(stmt.order_by(Job.created_at.desc())).all()
    out = []
    for j in jobs:
        org = db.get(Organization, j.organization_id)
        # Safety checks evaluation
        min_salary = float(j.salary_min) if j.salary_min else 0
        safety_checks = {
            "salary_benchmark_met": min_salary >= 300000,
            "no_recruitment_fees": True,
            "duplicate_detected": False,
            "org_verified": org.verification_status == VerificationStatus.VERIFIED.value if org else False,
        }
        out.append(
            {
                "id": j.id,
                "title": j.title,
                "organization_name": org.name if org else None,
                "organization_verified": org.verification_status == VerificationStatus.VERIFIED.value if org else False,
                "status": j.status,
                "description": j.description,
                "location": j.location,
                "employment_type": j.employment_type,
                "work_mode": j.work_mode,
                "salary_min": float(j.salary_min) if j.salary_min else None,
                "salary_max": float(j.salary_max) if j.salary_max else None,
                "openings": j.openings,
                "skills": j.skills or [],
                "hiring_stages": j.hiring_stages or [],
                "moderation_note": j.moderation_note,
                "safety_checks": safety_checks,
                "created_at": j.created_at.isoformat() if j.created_at else None,
            }
        )
    return success_data(out, request)


@router.get("/jobs/pending-moderation")
def pending_jobs(db: DbSession, user: CurrentUser, request: Request, _: str = Depends(attach_request_id)):
    require_roles(UserRole.PLATFORM_ADMINISTRATOR)(user)
    jobs = db.scalars(
        select(Job).where(Job.status.in_([JobStatus.UNDER_REVIEW.value, JobStatus.SUBMITTED.value])).order_by(Job.created_at.desc())
    ).all()
    out = []
    for j in jobs:
        org = db.get(Organization, j.organization_id)
        min_salary = float(j.salary_min) if j.salary_min else 0
        out.append(
            {
                "id": j.id,
                "title": j.title,
                "organization_name": org.name if org else None,
                "organization_verified": org.verification_status == VerificationStatus.VERIFIED.value if org else False,
                "status": j.status,
                "description": j.description,
                "location": j.location,
                "employment_type": j.employment_type,
                "work_mode": j.work_mode,
                "salary_min": min_salary,
                "salary_max": float(j.salary_max) if j.salary_max else None,
                "openings": j.openings,
                "skills": j.skills or [],
                "safety_checks": {
                    "salary_benchmark_met": min_salary >= 300000,
                    "no_recruitment_fees": True,
                    "duplicate_detected": False,
                    "org_verified": org.verification_status == VerificationStatus.VERIFIED.value if org else False,
                },
            }
        )
    return success_data(out, request)


@router.post("/jobs/{job_id}/moderate")
def moderate(
    job_id: str,
    body: ModerationBody,
    db: DbSession,
    user: CurrentUser,
    request: Request,
    _: str = Depends(attach_request_id),
):
    require_roles(UserRole.PLATFORM_ADMINISTRATOR)(user)
    job = db.get(Job, job_id)
    if not job:
        raise AppError("NOT_FOUND", "Job not found", 404)
    try:
        job_service.moderate_job(db, job, user, body.action, body.note)
        db.commit()
    except ValueError as e:
        db.rollback()
        raise AppError(str(e), str(e), 400)
    return success_data({"status": job.status, "moderation_note": job.moderation_note}, request)


@router.get("/stats")
def platform_stats(db: DbSession, user: CurrentUser, request: Request, _: str = Depends(attach_request_id)):
    require_roles(UserRole.PLATFORM_ADMINISTRATOR)(user)
    total_employers = db.scalar(
        select(func.count(Organization.id)).where(Organization.org_type == OrganizationType.EMPLOYER.value)
    ) or 0
    total_institutions = db.scalar(
        select(func.count(Organization.id)).where(Organization.org_type == OrganizationType.INSTITUTION.value)
    ) or 0
    total_students = db.scalar(
        select(func.count(User.id)).where(User.role == UserRole.STUDENT.value)
    ) or 0
    total_jobs = db.scalar(select(func.count(Job.id))) or 0
    pending_orgs = db.scalar(
        select(func.count(Organization.id)).where(
            Organization.verification_status.in_([VerificationStatus.PENDING.value, VerificationStatus.UNDER_REVIEW.value])
        )
    ) or 0
    pending_jobs = db.scalar(
        select(func.count(Job.id)).where(
            Job.status.in_([JobStatus.UNDER_REVIEW.value, JobStatus.SUBMITTED.value])
        )
    ) or 0
    total_applications = db.scalar(select(func.count(Application.id))) or 0
    total_offers = db.scalar(select(func.count(Offer.id))) or 0
    verified_placements = db.scalar(
        select(func.count(Placement.id)).where(Placement.status == "VERIFIED")
    ) or 0
    active_jobs = db.scalar(
        select(func.count(Job.id)).where(Job.status == JobStatus.PUBLISHED.value)
    ) or 0

    return success_data(
        {
            "total_employers": total_employers,
            "total_institutions": total_institutions,
            "total_students": total_students,
            "total_jobs": total_jobs,
            "active_jobs": active_jobs,
            "total_applications": total_applications,
            "total_offers": total_offers,
            "verified_placements": verified_placements,
            "pending_organizations": pending_orgs,
            "pending_jobs": pending_jobs,
        },
        request,
    )


@router.get("/audit-logs")
def audit_logs(
    db: DbSession,
    user: CurrentUser,
    request: Request,
    limit: int = Query(50, ge=1, le=200),
    action: str | None = None,
    resource_type: str | None = None,
    actor_id: str | None = None,
    _: str = Depends(attach_request_id),
):
    require_roles(UserRole.PLATFORM_ADMINISTRATOR)(user)
    stmt = select(AuditEvent).order_by(AuditEvent.created_at.desc())
    if action:
        stmt = stmt.where(AuditEvent.action.ilike(f"%{action}%"))
    if resource_type:
        stmt = stmt.where(AuditEvent.resource_type == resource_type)
    if actor_id:
        stmt = stmt.where(AuditEvent.actor_id == actor_id)
    logs = db.scalars(stmt.limit(limit)).all()
    out = []
    for l in logs:
        actor = db.get(User, l.actor_id) if l.actor_id else None
        out.append(
            {
                "id": l.id,
                "actor_id": l.actor_id,
                "actor_name": actor.full_name if actor else "System",
                "actor_email": actor.email if actor else None,
                "actor_role": actor.role if actor else None,
                "action": l.action,
                "resource_type": l.resource_type,
                "resource_id": l.resource_id,
                "metadata": l.audit_metadata,
                "created_at": l.created_at.isoformat() if l.created_at else None,
            }
        )
    return success_data(out, request)
