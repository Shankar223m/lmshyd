from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import (
    Application,
    Job,
    Offer,
    Organization,
    Placement,
    PlacementEvidence,
    StoredFile,
    StudentProfile,
    User,
    VerificationDocument,
)
from app.modules.jobs.access import user_can_access_job
from app.shared.enums import UserRole


def can_access_file(db: Session, user: User, record: StoredFile) -> bool:
    if user.role == UserRole.PLATFORM_ADMINISTRATOR.value:
        return True

    if record.owner_id == user.id:
        return True

    category = (record.category or "").lower()

    # 1. Resumes and Application Documents
    # Check directly via category or via DB foreign key relation
    app = db.scalar(select(Application).where(Application.resume_file_id == record.id))
    if app:
        if user.role == UserRole.STUDENT.value:
            return app.student_id == user.id
        job = db.get(Job, app.job_id)
        if job and user_can_access_job(db, user, job.id):
            return True
        if job and user.organization_id and user.organization_id == job.organization_id:
            return True

    profile = db.scalar(select(StudentProfile).where(StudentProfile.resume_file_id == record.id))
    if profile:
        if user.role == UserRole.STUDENT.value:
            return profile.user_id == user.id
        if user.role == UserRole.INSTITUTION.value and user.organization_id:
            return profile.institution_id == user.organization_id
        owner = db.get(User, profile.user_id)
        if owner and user.role in (UserRole.RECRUITER.value, UserRole.EMPLOYER.value):
            apps = db.scalars(select(Application).where(Application.student_id == owner.id)).all()
            for a in apps:
                if user_can_access_job(db, user, a.job_id):
                    return True
                job = db.get(Job, a.job_id)
                if job and user.organization_id and user.organization_id == job.organization_id:
                    return True

    if category in ("resume", "resumes", "application", "applications", "general"):
        # Catch any general uploaded file where owner is student and caller reviews candidate
        owner = db.get(User, record.owner_id)
        if owner and user.role in (UserRole.RECRUITER.value, UserRole.EMPLOYER.value):
            apps = db.scalars(select(Application).where(Application.student_id == owner.id)).all()
            for a in apps:
                if user_can_access_job(db, user, a.job_id):
                    return True

    # 2. Offers and Offer Letters
    offer = db.scalar(select(Offer).where(Offer.offer_letter_file_id == record.id))
    if offer:
        app = db.get(Application, offer.application_id)
        if app:
            if user.role == UserRole.STUDENT.value:
                return app.student_id == user.id
            if user_can_access_job(db, user, app.job_id):
                return True
            job = db.get(Job, app.job_id)
            if job and user.organization_id and user.organization_id == job.organization_id:
                return True

    if category in ("offer", "offers", "offer_letter", "offer_letters"):
        pass

    # 3. Placements and Placement Evidence
    placement = db.scalar(select(Placement).where(Placement.evidence_file_id == record.id))
    if placement:
        return _can_access_placement(db, user, placement)

    pe = db.scalar(select(PlacementEvidence).where(PlacementEvidence.file_id == record.id))
    if pe:
        placement = db.get(Placement, pe.placement_id)
        if placement:
            return _can_access_placement(db, user, placement)

    # 4. Organization Verification Documents
    vdoc = db.scalar(select(VerificationDocument).where(VerificationDocument.file_id == record.id))
    if vdoc:
        if user.role == UserRole.PLATFORM_ADMINISTRATOR.value:
            return True
        org = db.get(Organization, vdoc.organization_id)
        if org and user.organization_id == org.id:
            return user.role in (UserRole.EMPLOYER.value, UserRole.INSTITUTION.value)
        return False

    return False


def _can_access_placement(db: Session, user: User, placement: Placement) -> bool:
    if user.role == UserRole.STUDENT.value:
        return placement.student_id == user.id
    if user.role == UserRole.INSTITUTION.value and user.organization_id:
        return placement.institution_id == user.organization_id
    app = db.get(Application, placement.application_id)
    if app and user.role in (UserRole.EMPLOYER.value, UserRole.RECRUITER.value):
        if user_can_access_job(db, user, app.job_id):
            return True
        job = db.get(Job, app.job_id)
        if job and user.organization_id and user.organization_id == job.organization_id:
            return True
    return False
