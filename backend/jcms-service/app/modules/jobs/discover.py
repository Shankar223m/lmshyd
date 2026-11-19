"""Student visibility rules for published jobs (campus vs open market)."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import Job, StudentProfile, User
from app.shared.enums import JobPostingChannel


def get_student_profile(db: Session, user: User) -> StudentProfile | None:
    return db.scalar(select(StudentProfile).where(StudentProfile.user_id == user.id))


def job_visible_to_student(db: Session, job: Job, user: User) -> bool:
    channel = (job.posting_channel or JobPostingChannel.OPEN.value).upper()
    profile = get_student_profile(db, user)

    if channel == JobPostingChannel.OPEN.value:
        return True

    if channel != JobPostingChannel.CAMPUS.value:
        return True

    if profile and profile.open_market_only:
        return False

    campus_id = job.campus_institution_id or job.organization_id
    if not profile or not profile.institution_id:
        return False
    return profile.institution_id == campus_id


def posting_channel_tagline(channel: str | None) -> str:
    normalized = (channel or JobPostingChannel.OPEN.value).upper()
    if normalized == JobPostingChannel.CAMPUS.value:
        return "Campus placement role — for students at your institution’s placement program."
    return "Open market role — open to eligible candidates beyond campus drives."