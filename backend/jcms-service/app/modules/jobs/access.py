from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import Job, RecruiterAssignment, User
from app.shared.enums import UserRole


def recruiter_assigned_job_ids(db: Session, recruiter_id: str) -> list[str]:
    return list(
        db.scalars(
            select(RecruiterAssignment.job_id).where(RecruiterAssignment.recruiter_id == recruiter_id)
        ).all()
    )


def employer_org_job_ids(db: Session, organization_id: str) -> list[str]:
    return list(db.scalars(select(Job.id).where(Job.organization_id == organization_id)).all())


def accessible_job_ids_for_user(db: Session, user: User) -> list[str] | None:
    """Return job ids the user may access for recruitment, or None for unrestricted (platform admin)."""
    if user.role == UserRole.PLATFORM_ADMINISTRATOR.value:
        return None
    if user.role == UserRole.EMPLOYER.value and user.organization_id:
        return employer_org_job_ids(db, user.organization_id)
    if user.role == UserRole.INSTITUTION.value and user.organization_id:
        return list(
            db.scalars(
                select(Job.id).where(
                    Job.organization_id == user.organization_id,
                    Job.posting_channel == "CAMPUS",
                )
            ).all()
        )
    return []


def user_can_access_job(db: Session, user: User, job_id: str) -> bool:
    ids = accessible_job_ids_for_user(db, user)
    if ids is None:
        return True
    return job_id in ids
