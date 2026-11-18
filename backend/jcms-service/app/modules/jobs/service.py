from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.entities import (
    Application,
    Interview,
    Job,
    Offer,
    Organization,
    RecruiterAssignment,
    User,
)
from app.modules.audit.service import record_audit
from app.modules.notifications.service import notify_user
from app.shared.enums import ApplicationStatus, JobStatus, UserRole, VerificationStatus


def ensure_verified_employer(org: Organization) -> None:
    if org.verification_status != VerificationStatus.VERIFIED.value:
        raise ValueError("ORG_NOT_VERIFIED")


def create_job(db: Session, employer: User, data: dict) -> Job:
    if employer.role != UserRole.EMPLOYER.value or not employer.organization_id:
        raise ValueError("FORBIDDEN")
    org = db.get(Organization, employer.organization_id)
    if not org:
        raise ValueError("ORG_NOT_FOUND")
    job = Job(
        organization_id=org.id,
        title=data["title"],
        description=data.get("description", ""),
        location=data.get("location"),
        employment_type=data.get("employment_type", "FULL_TIME"),
        work_mode=data.get("work_mode", "HYBRID"),
        salary_min=data.get("salary_min"),
        salary_max=data.get("salary_max"),
        salary_currency=data.get("salary_currency", "INR"),
        openings=data.get("openings", 1),
        closes_on=data.get("closes_on"),
        skills=data.get("skills", []),
        hiring_stages=data.get("hiring_stages", []),
        questions=data.get("questions", []),
        status=JobStatus.DRAFT.value,
        requires_moderation=data.get("requires_moderation", True),
    )
    db.add(job)
    db.flush()
    for rid in data.get("recruiter_ids", []):
        db.add(RecruiterAssignment(job_id=job.id, recruiter_id=rid))
    from app.modules.eligibility.service import seed_eligibility_from_payload

    seed_eligibility_from_payload(db, job, data.get("eligibility"))
    record_audit(db, actor_id=employer.id, action="job.create", resource_type="job", resource_id=job.id)
    return job


def submit_job(db: Session, job: Job, actor: User) -> Job:
    _assert_job_owner(db, job, actor)
    if job.status not in (JobStatus.DRAFT.value, JobStatus.CHANGES_REQUIRED.value):
        raise ValueError("INVALID_TRANSITION")
    job.status = JobStatus.UNDER_REVIEW.value if job.requires_moderation else JobStatus.APPROVED.value
    admins = db.scalars(
        select(User).where(User.role == UserRole.PLATFORM_ADMINISTRATOR.value)
    ).all()
    for admin in admins:
        notify_user(
            db,
            user_id=admin.id,
            title="Job submitted for moderation",
            body=f"Job '{job.title}' awaits review.",
            resource_type="job",
            resource_id=job.id,
        )
    record_audit(db, actor_id=actor.id, action="job.submit", resource_type="job", resource_id=job.id)
    return job


def moderate_job(db: Session, job: Job, admin: User, action: str, note: str | None) -> Job:
    if admin.role != UserRole.PLATFORM_ADMINISTRATOR.value:
        raise ValueError("FORBIDDEN")
    if action == "approve":
        job.status = JobStatus.PUBLISHED.value
        job.moderation_note = note
        notify_user(
            db,
            user_id=_employer_admin_id(db, job.organization_id),
            title="Job approved",
            body=f"Your job '{job.title}' is published.",
            resource_type="job",
            resource_id=job.id,
        )
    elif action == "reject":
        job.status = JobStatus.REJECTED.value
        job.moderation_note = note
        notify_user(
            db,
            user_id=_employer_admin_id(db, job.organization_id),
            title="Job rejected",
            body=f"Your job '{job.title}' was rejected." + (f" Note: {note}" if note else ""),
            resource_type="job",
            resource_id=job.id,
        )
    elif action == "request_changes":
        job.status = JobStatus.CHANGES_REQUIRED.value
        job.moderation_note = note
        notify_user(
            db,
            user_id=_employer_admin_id(db, job.organization_id),
            title="Job changes requested",
            body=f"Revise and resubmit '{job.title}'." + (f" Note: {note}" if note else ""),
            resource_type="job",
            resource_id=job.id,
        )
    else:
        raise ValueError("INVALID_ACTION")
    record_audit(
        db,
        actor_id=admin.id,
        action=f"job.moderate.{action}",
        resource_type="job",
        resource_id=job.id,
        metadata={"note": note},
    )
    return job


def publish_job(db: Session, job: Job, actor: User) -> Job:
    _assert_job_owner(db, job, actor)
    org = db.get(Organization, job.organization_id)
    if org:
        ensure_verified_employer(org)
    if job.status not in (JobStatus.APPROVED.value, JobStatus.DRAFT.value):
        if job.status != JobStatus.PUBLISHED.value:
            raise ValueError("INVALID_TRANSITION")
    job.status = JobStatus.PUBLISHED.value
    record_audit(db, actor_id=actor.id, action="job.publish", resource_type="job", resource_id=job.id)
    return job


def close_job(db: Session, job: Job, actor: User) -> Job:
    _assert_job_owner(db, job, actor)
    job.status = JobStatus.CLOSED.value
    record_audit(db, actor_id=actor.id, action="job.close", resource_type="job", resource_id=job.id)
    return job


def employer_job_stats(db: Session, org_id: str) -> dict:
    jobs = db.scalars(select(Job).where(Job.organization_id == org_id)).all()
    open_jobs = sum(1 for j in jobs if j.status == JobStatus.PUBLISHED.value)
    pending = sum(1 for j in jobs if j.status in (JobStatus.UNDER_REVIEW.value, JobStatus.SUBMITTED.value))
    job_ids = [j.id for j in jobs] or ["none"]
    
    app_count = db.scalar(
        select(func.count(Application.id)).where(Application.job_id.in_(job_ids))
    ) or 0
    
    app_ids = list(
        db.scalars(select(Application.id).where(Application.job_id.in_(job_ids))).all()
    ) or ["none"]
    
    interview_count = db.scalar(
        select(func.count(Interview.id)).where(Interview.application_id.in_(app_ids))
    ) or 0
    
    offers_count = db.scalar(
        select(func.count(Offer.id)).where(Offer.application_id.in_(app_ids))
    ) or 0

    return {
        "open_jobs": open_jobs,
        "pending_approval": pending,
        "total_applications": app_count,
        "interviews": interview_count,
        "offers_out": offers_count,
        "total_jobs": len(jobs),
    }


def pipeline_for_job(db: Session, job_id: str, actor: User) -> dict:
    job = db.get(Job, job_id)
    if not job:
        raise ValueError("NOT_FOUND")
    _assert_job_access(db, job, actor)
    apps = db.scalars(select(Application).where(Application.job_id == job_id)).all()
    stages = job.hiring_stages or ["Screening", "Shortlisted", "Assessment", "Interview", "Selected"]
    columns = {s: [] for s in stages}
    for app in apps:
        stage = app.pipeline_stage or _status_to_stage(app.status, stages)
        key = stage if stage in columns else stages[0]
        columns[key].append(app)
    return {"job_id": job_id, "stages": stages, "columns": columns}


def _status_to_stage(status: str, stages: list) -> str:
    mapping = {
        ApplicationStatus.SUBMITTED.value: stages[0],
        ApplicationStatus.SCREENING.value: stages[0],
        ApplicationStatus.SHORTLISTED.value: stages[1] if len(stages) > 1 else stages[0],
        ApplicationStatus.ASSESSMENT.value: stages[2] if len(stages) > 2 else stages[0],
        ApplicationStatus.INTERVIEW_SCHEDULED.value: stages[3] if len(stages) > 3 else stages[0],
        ApplicationStatus.SELECTED.value: stages[-1],
    }
    return mapping.get(status, stages[0])


def _assert_job_owner(db: Session, job: Job, user: User) -> None:
    if user.role == UserRole.PLATFORM_ADMINISTRATOR.value:
        return
    if user.role != UserRole.EMPLOYER.value or user.organization_id != job.organization_id:
        raise ValueError("FORBIDDEN")


def _assert_job_access(db: Session, job: Job, user: User) -> None:
    if user.role == UserRole.PLATFORM_ADMINISTRATOR.value:
        return
    if user.role == UserRole.EMPLOYER.value and user.organization_id == job.organization_id:
        return
    if user.role == UserRole.RECRUITER.value:
        assigned = db.scalar(
            select(RecruiterAssignment).where(
                RecruiterAssignment.job_id == job.id,
                RecruiterAssignment.recruiter_id == user.id,
            )
        )
        if assigned:
            return
    raise ValueError("FORBIDDEN")


def _employer_admin_id(db: Session, org_id: str) -> str:
    user = db.scalar(
        select(User).where(User.organization_id == org_id, User.role == UserRole.EMPLOYER.value)
    )
    return user.id if user else org_id
