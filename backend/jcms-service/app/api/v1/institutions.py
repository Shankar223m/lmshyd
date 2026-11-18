import secrets
from fastapi import APIRouter, Depends, Query, Request, Response
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, or_, select

from app.api.deps import CurrentUser, DbSession, attach_request_id, require_roles
from app.core.exceptions import AppError
from app.core.responses import success_data
from app.core.security import hash_password
from app.models.entities import Application, Job, Offer, Placement, StudentProfile, User, Organization
from app.modules.audit.service import record_audit
from app.modules.institutions.import_csv import parse_csv_text, validate_import_rows
from app.modules.reports.analytics_pdf import build_institution_analytics_pdf
from app.shared.enums import ApplicationStatus, PlacementStatus, UserRole

router = APIRouter(prefix="/institutions/me", tags=["institutions"])


class ImportConfirmBody(BaseModel):
    file_id: str | None = None
    rows: list[dict]


class ImportPreviewBody(BaseModel):
    file_id: str | None = None
    rows: list[dict] | None = None


@router.get("/students")
def list_students(
    db: DbSession,
    user: CurrentUser,
    request: Request,
    q: str | None = None,
    department: str | None = None,
    batch: str | None = None,
    placement_status: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    _: str = Depends(attach_request_id),
):
    require_roles(UserRole.INSTITUTION)(user)
    if not user.organization_id:
        raise AppError("FORBIDDEN", "No institution", 403)

    stmt = (
        select(User, StudentProfile)
        .join(StudentProfile, StudentProfile.user_id == User.id)
        .where(
            StudentProfile.institution_id == user.organization_id,
            User.role == UserRole.STUDENT.value,
        )
    )
    if q:
        stmt = stmt.where(
            or_(User.full_name.ilike(f"%{q}%"), User.email.ilike(f"%{q}%"))
        )
    if department:
        stmt = stmt.where(StudentProfile.department == department)
    if batch:
        stmt = stmt.where(StudentProfile.batch == batch)

    rows = db.execute(stmt).all()
    out = []
    for u, profile in rows:
        placement = db.scalar(select(Placement).where(Placement.student_id == u.id))
        p_status = placement.status if placement else "NOT_PLACED"
        if placement_status and placement_status != "ALL" and p_status != placement_status:
            continue
        app_count = db.scalar(
            select(func.count(Application.id)).where(Application.student_id == u.id)
        ) or 0
        out.append(
            {
                "id": u.id,
                "email": u.email,
                "full_name": u.full_name,
                "program": profile.program,
                "department": profile.department,
                "batch": profile.batch,
                "graduation_year": profile.graduation_year,
                "cgpa": float(profile.cgpa) if profile.cgpa else None,
                "placement_status": p_status,
                "application_count": app_count,
            }
        )

    total = len(out)
    start = (page - 1) * page_size
    page_items = out[start : start + page_size]
    return success_data(
        page_items,
        request,
        pagination={
            "page": page,
            "page_size": page_size,
            "total_items": total,
            "total_pages": (total + page_size - 1) // page_size if page_size else 0,
        },
    )


@router.get("/students/csv-template")
def csv_template(request: Request, _: str = Depends(attach_request_id)):
    content = "email,full_name,password,program,department,batch,graduation_year,cgpa,phone\n"
    content += "student1@college.edu,Jane Doe,ChangeMe123!,B.Tech CSE,CSE,2026,2026,8.5,9876543210\n"
    return Response(
        content=content,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="jcms_student_import_template.csv"'},
    )


@router.post("/students/import/preview")
def import_preview(
    body: ImportPreviewBody,
    db: DbSession,
    user: CurrentUser,
    request: Request,
    _: str = Depends(attach_request_id),
):
    require_roles(UserRole.INSTITUTION)(user)
    rows: list[dict] = []
    if body.rows:
        rows = body.rows
    elif body.file_id:
        from app.models.entities import StoredFile
        from app.modules.files.storage import file_storage

        record = db.get(StoredFile, body.file_id)
        if not record or record.owner_id != user.id:
            raise AppError("FORBIDDEN", "Invalid file", 403)
        try:
            raw = file_storage.read_bytes(record).decode("utf-8-sig")
        except Exception as exc:
            raise AppError("INVALID_FILE", "Could not read CSV", 400) from exc
        try:
            rows = parse_csv_text(raw)
        except ValueError as e:
            code = str(e)
            raise AppError(code, code.replace("_", " ").title(), 400)
    else:
        raise AppError("INVALID_BODY", "Provide rows or file_id", 400)

    result = validate_import_rows(db, rows)
    return success_data(result, request)


@router.post("/students/import")
def import_students(
    body: ImportConfirmBody,
    db: DbSession,
    user: CurrentUser,
    request: Request,
    _: str = Depends(attach_request_id),
):
    require_roles(UserRole.INSTITUTION)(user)
    if not user.organization_id:
        raise AppError("FORBIDDEN", "No institution", 403)

    created = 0
    skipped = []
    for row in body.rows:
        email = (row.get("email") or "").strip().lower()
        if not email:
            skipped.append({"email": email, "reason": "missing email"})
            continue
        if not (row.get("full_name") or "").strip() or not (row.get("program") or "").strip():
            skipped.append({"email": email, "reason": "missing required fields"})
            continue
        if db.scalar(select(User).where(User.email == email)):
            skipped.append({"email": email, "reason": "duplicate"})
            continue
        password = row.get("password") or secrets.token_urlsafe(18)  # never a well-known default; sign-in is through the LMS
        u = User(
            email=email,
            password_hash=hash_password(str(password)),
            full_name=row.get("full_name") or email,
            role=UserRole.STUDENT.value,
        )
        db.add(u)
        db.flush()
        db.add(
            StudentProfile(
                user_id=u.id,
                institution_id=user.organization_id,
                program=row.get("program"),
                department=row.get("department"),
                batch=row.get("batch"),
                graduation_year=int(row["graduation_year"]) if row.get("graduation_year") else None,
                cgpa=float(row["cgpa"]) if row.get("cgpa") else None,
                phone=row.get("phone"),
                skills=[],
            )
        )
        created += 1

    record_audit(
        db,
        actor_id=user.id,
        action="institution.students.import",
        resource_type="organization",
        resource_id=user.organization_id,
        metadata={"created": created, "skipped": len(skipped)},
    )
    db.commit()
    return success_data({"created": created, "skipped": skipped}, request)


@router.get("/analytics")
def institution_analytics(db: DbSession, user: CurrentUser, request: Request, _: str = Depends(attach_request_id)):
    require_roles(UserRole.INSTITUTION)(user)
    if not user.organization_id:
        raise AppError("FORBIDDEN", "No institution", 403)

    student_ids = list(
        db.scalars(
            select(StudentProfile.user_id).where(StudentProfile.institution_id == user.organization_id)
        ).all()
    )
    total = len(student_ids)
    applications = (
        db.scalar(
            select(func.count(Application.id)).where(Application.student_id.in_(student_ids or ["none"]))
        )
        or 0
    )
    shortlisted = (
        db.scalar(
            select(func.count(Application.id)).where(
                Application.student_id.in_(student_ids or ["none"]),
                Application.status.in_(
                    [
                        ApplicationStatus.SHORTLISTED.value,
                        ApplicationStatus.INTERVIEW_SCHEDULED.value,
                        ApplicationStatus.SELECTED.value,
                    ]
                ),
            )
        )
        or 0
    )
    offers = (
        db.scalar(
            select(func.count(Offer.id)).where(
                Offer.application_id.in_(
                    db.scalars(
                        select(Application.id).where(
                            Application.student_id.in_(student_ids or ["none"])
                        )
                    ).all()
                    or ["none"]
                )
            )
        )
        or 0
    )
    placed = (
        db.scalar(
            select(func.count(Placement.id)).where(
                Placement.institution_id == user.organization_id,
                Placement.status == PlacementStatus.VERIFIED.value,
            )
        )
        or 0
    )

    return success_data(
        {
            "total_students": total,
            "applications": applications,
            "shortlisted": shortlisted,
            "offers": offers,
            "placed": placed,
            "placement_percentage": int((placed / total) * 100) if total else 0,
        },
        request,
    )


@router.get("/analytics/export.csv")
def export_analytics_csv(db: DbSession, user: CurrentUser, _: str = Depends(attach_request_id)):
    require_roles(UserRole.INSTITUTION)(user)
    if not user.organization_id:
        raise AppError("FORBIDDEN", "No institution", 403)
    student_ids = list(
        db.scalars(
            select(StudentProfile.user_id).where(StudentProfile.institution_id == user.organization_id)
        ).all()
    )
    total = len(student_ids)
    placed = (
        db.scalar(
            select(func.count(Placement.id)).where(
                Placement.institution_id == user.organization_id,
                Placement.status == PlacementStatus.VERIFIED.value,
            )
        )
        or 0
    )
    applications = (
        db.scalar(
            select(func.count(Application.id)).where(Application.student_id.in_(student_ids or ["none"]))
        )
        or 0
    )
    lines = [
        "metric,value",
        f"total_students,{total}",
        f"applications,{applications}",
        f"placed,{placed}",
        f"placement_percentage,{int((placed / total) * 100) if total else 0}",
    ]
    return Response(
        content="\n".join(lines) + "\n",
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="institution_analytics.csv"'},
    )


@router.get("/analytics/export.pdf")
def export_analytics_pdf(db: DbSession, user: CurrentUser, _: str = Depends(attach_request_id)):
    require_roles(UserRole.INSTITUTION)(user)
    if not user.organization_id:
        raise AppError("FORBIDDEN", "No institution", 403)
    org = db.get(Organization, user.organization_id)
    student_ids = list(
        db.scalars(
            select(StudentProfile.user_id).where(StudentProfile.institution_id == user.organization_id)
        ).all()
    )
    total = len(student_ids)
    placed = (
        db.scalar(
            select(func.count(Placement.id)).where(
                Placement.institution_id == user.organization_id,
                Placement.status == PlacementStatus.VERIFIED.value,
            )
        )
        or 0
    )
    applications = (
        db.scalar(
            select(func.count(Application.id)).where(Application.student_id.in_(student_ids or ["none"]))
        )
        or 0
    )
    shortlisted = (
        db.scalar(
            select(func.count(Application.id)).where(
                Application.student_id.in_(student_ids or ["none"]),
                Application.status.in_(
                    [
                        ApplicationStatus.SHORTLISTED.value,
                        ApplicationStatus.INTERVIEW_SCHEDULED.value,
                        ApplicationStatus.SELECTED.value,
                    ]
                ),
            )
        )
        or 0
    )
    offers = (
        db.scalar(
            select(func.count(Offer.id)).where(
                Offer.application_id.in_(
                    db.scalars(
                        select(Application.id).where(
                            Application.student_id.in_(student_ids or ["none"])
                        )
                    ).all()
                    or ["none"]
                )
            )
        )
        or 0
    )
    metrics = {
        "total_students": total,
        "applications": applications,
        "shortlisted": shortlisted,
        "offers": offers,
        "placed": placed,
        "placement_percentage": int((placed / total) * 100) if total else 0,
    }
    pdf_bytes = build_institution_analytics_pdf(
        institution_name=org.name if org else "Institution",
        metrics=metrics,
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="institution_analytics.pdf"'},
    )
