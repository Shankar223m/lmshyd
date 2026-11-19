from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import func, select

from app.api.deps import CurrentUser, DbSession, attach_request_id, require_roles
from app.core.exceptions import AppError
from app.core.responses import success_data
from app.models.entities import Application, EligibilityRule, Job, Organization, RecruiterAssignment, User
from app.modules.eligibility import service as eligibility_service
from app.modules.eligibility.service import evaluate_eligibility
from app.modules.applications import service as app_service
from app.modules.jobs import service as job_service
from app.modules.jobs.discover import job_visible_to_student, posting_channel_tagline
from app.shared.enums import EligibilityResult, JobPostingChannel, JobStatus, UserRole

router = APIRouter(tags=["jobs"])


class EligibilityBody(BaseModel):
    programs: list[str] = Field(default_factory=lambda: ["B.Tech CSE", "B.Tech Computer Science"])
    graduation_year_min: int = 2025
    graduation_year_max: int = 2027
    min_cgpa: float = 7.0
    required_skills: list[str] = Field(default_factory=list)
    max_backlogs: int | None = None


class JobCreate(BaseModel):
    title: str
    description: str = ""
    location: str | None = None
    employment_type: str = "FULL_TIME"
    work_mode: str = "HYBRID"
    salary_min: float | None = None
    salary_max: float | None = None
    salary_currency: str = "INR"
    openings: int = 1
    closes_on: date | None = None
    skills: list[str] = Field(default_factory=list)
    hiring_stages: list[str] = Field(default_factory=list)
    questions: list[dict] = Field(default_factory=list)
    recruiter_ids: list[str] = Field(default_factory=list)
    requires_moderation: bool = True
    eligibility: EligibilityBody | None = None
    organization_id: str | None = None
    thumbnail_file_id: str | None = None
    posting_channel: str | None = None


def _job_dict(db, job: Job, org_name: str | None = None) -> dict[str, Any]:
    applicant_count = db.scalar(
        select(func.count(Application.id)).where(Application.job_id == job.id)
    ) or 0
    from app.modules.applications.service import application_visible_in_employer_pipeline

    pipeline_apps = db.scalars(select(Application).where(Application.job_id == job.id)).all()
    active_applicant_count = sum(1 for a in pipeline_apps if application_visible_in_employer_pipeline(a))
    recruiter_ids = [
        ra.recruiter_id for ra in db.scalars(
            select(RecruiterAssignment).where(RecruiterAssignment.job_id == job.id)
        ).all()
    ]
    rules = eligibility_service.get_rules_for_job(db, job)
    eligibility = eligibility_service.rules_as_dict(rules) if rules else eligibility_service.rules_as_dict([])
    if not rules and job.skills:
        eligibility["required_skills"] = list(job.skills)
    return {
        "id": job.id,
        "title": job.title,
        "description": job.description,
        "location": job.location,
        "employment_type": job.employment_type,
        "work_mode": job.work_mode,
        "salary_min": float(job.salary_min) if job.salary_min else None,
        "salary_max": float(job.salary_max) if job.salary_max else None,
        "salary_currency": job.salary_currency or "INR",
        "openings": job.openings,
        "closes_on": job.closes_on.isoformat() if job.closes_on else None,
        "status": job.status,
        "skills": job.skills or [],
        "hiring_stages": job.hiring_stages or ["Screening", "Shortlisted", "Assessment", "Interview", "Selected"],
        "questions": job.questions or [],
        "organization_id": job.organization_id,
        "organization_name": org_name,
        "thumbnail_file_id": job.thumbnail_file_id,
        "applicant_count": applicant_count,
        "active_applicant_count": active_applicant_count,
        "recruiter_ids": recruiter_ids,
        "eligibility": eligibility,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "posting_channel": job.posting_channel or JobPostingChannel.OPEN.value,
        "campus_institution_id": job.campus_institution_id,
        "posting_tagline": posting_channel_tagline(job.posting_channel),
    }


@router.post("/jobs")
def create_job(
    body: JobCreate,
    db: DbSession,
    user: CurrentUser,
    request: Request,
    _: str = Depends(attach_request_id),
):
    require_roles(UserRole.EMPLOYER, UserRole.PLATFORM_ADMINISTRATOR)(user)
    try:
        job = job_service.create_job(db, user, body.model_dump())
        db.commit()
    except ValueError as e:
        db.rollback()
        code = str(e)
        status = 403 if code in ("FORBIDDEN", "ORG_NOT_VERIFIED") else 400
        raise AppError(code, code, status)
    org = db.get(Organization, job.organization_id)
    return success_data(_job_dict(db, job, org.name if org else None), request)


@router.post("/institutions/me/campus-jobs")
def create_campus_job(
    body: JobCreate,
    db: DbSession,
    user: CurrentUser,
    request: Request,
    _: str = Depends(attach_request_id),
):
    require_roles(UserRole.INSTITUTION)(user)
    try:
        job = job_service.create_campus_job(db, user, body.model_dump())
        db.commit()
    except ValueError as e:
        db.rollback()
        code = str(e)
        status = 403 if code == "FORBIDDEN" else 400
        raise AppError(code, code, status)
    org = db.get(Organization, job.organization_id)
    return success_data(_job_dict(db, job, org.name if org else None), request)


@router.get("/jobs/discover")
def discover_jobs(
    db: DbSession,
    user: CurrentUser,
    request: Request,
    q: str | None = None,
    work_mode: str | None = None,
    employment_type: str | None = None,
    eligible_only: bool = False,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sort: str | None = Query(None, description="created_at_desc|created_at_asc|title_asc|title_desc"),
    _: str = Depends(attach_request_id),
):
    require_roles(UserRole.STUDENT, UserRole.PLATFORM_ADMINISTRATOR)(user)
    is_admin = user.role == UserRole.PLATFORM_ADMINISTRATOR.value
    stmt = select(Job).where(Job.status == JobStatus.PUBLISHED.value)
    if work_mode:
        stmt = stmt.where(Job.work_mode == work_mode.upper())
    if employment_type:
        stmt = stmt.where(Job.employment_type == employment_type.upper())

    jobs = db.scalars(stmt).all()
    if q:
        q_lower = q.lower()
        jobs = [
            j for j in jobs
            if q_lower in j.title.lower()
            or (j.description and q_lower in j.description.lower())
            or (j.skills and any(q_lower in s.lower() for s in j.skills))
        ]

    out = []
    for job in jobs:
        if not is_admin and not job_visible_to_student(db, job, user):
            continue
        org = db.get(Organization, job.organization_id)
        item = _job_dict(db, job, org.name if org else None)
        if is_admin:
            out.append(item)
            continue
        ev = evaluate_eligibility(db, job, user)
        db.flush()
        if eligible_only and ev.result != EligibilityResult.ELIGIBLE.value:
            continue
        item["match_percent"] = ev.match_percent
        item["eligibility"] = ev.result
        item["eligibility_details"] = ev.details
        out.append(item)
    if sort == "title_asc":
        out.sort(key=lambda x: (x.get("title") or "").lower())
    elif sort == "title_desc":
        out.sort(key=lambda x: (x.get("title") or "").lower(), reverse=True)
    elif sort == "created_at_asc":
        out.sort(key=lambda x: x.get("created_at") or "")
    else:
        out.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    # Collapse QA/seed duplicates: same employer + same title → keep newest only.
    deduped: list[dict] = []
    seen: set[tuple[str, str]] = set()
    for item in out:
        key = (str(item.get("organization_id") or ""), (item.get("title") or "").strip().lower())
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)
    out = deduped
    total = len(out)
    start = (page - 1) * page_size
    page_items = out[start : start + page_size]
    db.commit()
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


@router.get("/employers/me/jobs")
def employer_jobs(db: DbSession, user: CurrentUser, request: Request, _: str = Depends(attach_request_id)):
    require_roles(UserRole.EMPLOYER)(user)
    app_service.auto_issue_pending_offers_for_org(db, user)
    db.commit()
    jobs = db.scalars(
        select(Job).where(Job.organization_id == user.organization_id).order_by(Job.created_at.desc())
    ).all()
    stats = job_service.employer_job_stats(db, user.organization_id)
    org = db.get(Organization, user.organization_id)
    return success_data(
        {"stats": stats, "jobs": [_job_dict(db, j, org.name if org else None) for j in jobs]},
        request,
    )


@router.get("/jobs/{job_id}")
def get_job(job_id: str, db: DbSession, user: CurrentUser, request: Request, _: str = Depends(attach_request_id)):
    job = db.get(Job, job_id)
    if not job:
        raise AppError("NOT_FOUND", "Job not found", 404)
    org = db.get(Organization, job.organization_id)
    if user.role in (UserRole.EMPLOYER.value, UserRole.INSTITUTION.value):
        try:
            job_service._assert_job_access(db, job, user)
        except ValueError:
            raise AppError("NOT_FOUND", "Job not found", 404)
    data = _job_dict(db, job, org.name if org else None)
    if user.role == UserRole.STUDENT.value:
        if not job_visible_to_student(db, job, user):
            raise AppError("NOT_FOUND", "Job not found", 404)
        ev = evaluate_eligibility(db, job, user)
        db.commit()
        data["match_percent"] = ev.match_percent
        data["eligibility"] = ev.result
        data["eligibility_details"] = ev.details
    return success_data(data, request)


@router.patch("/jobs/{job_id}")
def patch_job(
    job_id: str,
    body: JobCreate,
    db: DbSession,
    user: CurrentUser,
    request: Request,
    _: str = Depends(attach_request_id),
):
    job = db.get(Job, job_id)
    if not job:
        raise AppError("NOT_FOUND", "Job not found", 404)
    try:
        job_service._assert_job_owner(db, job, user)
    except ValueError:
        raise AppError("FORBIDDEN", "Forbidden", 403)
    payload = body.model_dump(exclude_unset=True)
    eligibility = payload.pop("eligibility", None)
    payload.pop("organization_id", None)  # ownership org is fixed after create
    for k, v in payload.items():
        if k == "recruiter_ids":
            db.query(RecruiterAssignment).filter(RecruiterAssignment.job_id == job.id).delete()
            for rid in v:
                db.add(RecruiterAssignment(job_id=job.id, recruiter_id=rid))
        elif hasattr(job, k):
            setattr(job, k, v)
    if eligibility is not None:
        try:
            eligibility_service.replace_eligibility_rules(db, job, eligibility, user)
        except ValueError as e:
            db.rollback()
            raise AppError(str(e), str(e), 403 if str(e) == "FORBIDDEN" else 400)
    db.commit()
    org = db.get(Organization, job.organization_id)
    return success_data(_job_dict(db, job, org.name if org else None), request)


@router.get("/jobs/{job_id}/eligibility")
def get_job_eligibility(
    job_id: str, db: DbSession, user: CurrentUser, request: Request, _: str = Depends(attach_request_id)
):
    job = db.get(Job, job_id)
    if not job:
        raise AppError("NOT_FOUND", "Job not found", 404)
    if user.role == UserRole.EMPLOYER.value:
        try:
            job_service._assert_job_owner(db, job, user)
        except ValueError:
            raise AppError("FORBIDDEN", "Forbidden", 403)
    elif user.role not in (UserRole.PLATFORM_ADMINISTRATOR.value, UserRole.RECRUITER.value, UserRole.STUDENT.value):
        raise AppError("FORBIDDEN", "Forbidden", 403)
    rules = eligibility_service.get_rules_for_job(db, job)
    return success_data(eligibility_service.rules_as_dict(rules), request)


@router.put("/jobs/{job_id}/eligibility")
def put_job_eligibility(
    job_id: str,
    body: EligibilityBody,
    db: DbSession,
    user: CurrentUser,
    request: Request,
    _: str = Depends(attach_request_id),
):
    require_roles(UserRole.EMPLOYER, UserRole.PLATFORM_ADMINISTRATOR)(user)
    job = db.get(Job, job_id)
    if not job:
        raise AppError("NOT_FOUND", "Job not found", 404)
    try:
        eligibility_service.replace_eligibility_rules(db, job, body.model_dump(), user)
        db.commit()
    except ValueError as e:
        db.rollback()
        raise AppError(str(e), str(e), 403 if str(e) == "FORBIDDEN" else 400)
    return success_data(eligibility_service.rules_as_dict(eligibility_service.get_rules_for_job(db, job)), request)


@router.post("/jobs/{job_id}/submit")
def submit(job_id: str, db: DbSession, user: CurrentUser, request: Request, _: str = Depends(attach_request_id)):
    job = db.get(Job, job_id)
    if not job:
        raise AppError("NOT_FOUND", "Job not found", 404)
    try:
        job_service.submit_job(db, job, user)
        db.commit()
    except ValueError as e:
        db.rollback()
        raise AppError(str(e), str(e), 400)
    return success_data({"status": job.status}, request)


@router.post("/jobs/{job_id}/publish")
def publish(job_id: str, db: DbSession, user: CurrentUser, request: Request, _: str = Depends(attach_request_id)):
    job = db.get(Job, job_id)
    if not job:
        raise AppError("NOT_FOUND", "Job not found", 404)
    try:
        job_service.publish_job(db, job, user)
        db.commit()
    except ValueError as e:
        db.rollback()
        raise AppError(str(e), str(e), 400)
    return success_data({"status": job.status}, request)


@router.post("/jobs/{job_id}/close")
def close_job_endpoint(job_id: str, db: DbSession, user: CurrentUser, request: Request, _: str = Depends(attach_request_id)):
    job = db.get(Job, job_id)
    if not job:
        raise AppError("NOT_FOUND", "Job not found", 404)
    try:
        job_service.close_job(db, job, user)
        db.commit()
    except ValueError as e:
        db.rollback()
        raise AppError(str(e), str(e), 400)
    return success_data({"status": job.status}, request)


@router.get("/jobs/{job_id}/pipeline")
def pipeline(job_id: str, db: DbSession, user: CurrentUser, request: Request, _: str = Depends(attach_request_id)):
    try:
        data = job_service.pipeline_for_job(db, job_id, user)
    except ValueError as e:
        raise AppError(str(e), str(e), 403 if str(e) == "FORBIDDEN" else 404)

    def ser(app):
        student = db.get(User, app.student_id)
        profile = student.student_profile if student else None
        inst = db.get(Organization, profile.institution_id) if profile and profile.institution_id else None
        return {
            "id": app.id,
            "student_id": app.student_id,
            "student_name": student.full_name if student else None,
            "student_email": student.email if student else None,
            "program": profile.program if profile else None,
            "cgpa": float(profile.cgpa) if profile and profile.cgpa else None,
            "graduation_year": profile.graduation_year if profile else None,
            "institution_name": inst.name if inst else None,
            "status": app.status,
            "pipeline_stage": app.pipeline_stage,
            "match_percent": app.match_percent,
            "answers": app.answers,
            "resume_file_id": app.resume_file_id,
            "created_at": app.created_at.isoformat() if app.created_at else None,
        }

    columns = {k: [ser(a) for a in v] for k, v in data["columns"].items()}
    return success_data({**data, "columns": columns}, request)


@router.post("/jobs/{job_id}/eligibility-check")
def eligibility_check(
    job_id: str, db: DbSession, user: CurrentUser, request: Request, _: str = Depends(attach_request_id)
):
    require_roles(UserRole.STUDENT)(user)
    job = db.get(Job, job_id)
    if not job:
        raise AppError("NOT_FOUND", "Job not found", 404)
    ev = evaluate_eligibility(db, job, user)
    db.commit()
    return success_data(
        {"result": ev.result, "match_percent": ev.match_percent, "details": ev.details},
        request,
    )
