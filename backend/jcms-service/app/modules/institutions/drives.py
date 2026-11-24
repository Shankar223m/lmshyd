"""Campus drives visible to an institution placement cell."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.entities import Application, Job, Organization, StudentProfile, User
from app.shared.enums import ApplicationStatus, JobStatus


def job_assigned_to_institution(job: Job, institution_id: str) -> bool:
    targets = [str(x) for x in (job.target_institution_ids or []) if x]
    if targets:
        return institution_id in targets
    if job.campus_institution_id:
        return job.campus_institution_id == institution_id
    return False


def institution_student_ids(db: Session, institution_id: str) -> list[str]:
    return list(
        db.scalars(
            select(StudentProfile.user_id).where(StudentProfile.institution_id == institution_id)
        ).all()
    )


def list_campus_drives_for_institution(db: Session, institution_id: str) -> list[dict]:
    jobs = db.scalars(select(Job).where(Job.status == JobStatus.PUBLISHED.value)).all()
    student_ids = institution_student_ids(db, institution_id)
    out: list[dict] = []
    for job in jobs:
        if not job_assigned_to_institution(job, institution_id):
            continue
        employer = db.get(Organization, job.organization_id)
        if student_ids:
            applicants = (
                db.scalar(
                    select(func.count(Application.id)).where(
                        Application.job_id == job.id,
                        Application.student_id.in_(student_ids),
                        Application.status != ApplicationStatus.WITHDRAWN.value,
                    )
                )
                or 0
            )
        else:
            applicants = 0
        out.append(
            {
                "id": job.id,
                "title": job.title,
                "employer_name": employer.name if employer else None,
                "status": job.status,
                "closes_on": job.closes_on.isoformat() if job.closes_on else None,
                "salary_min": float(job.salary_min) if job.salary_min else None,
                "salary_max": float(job.salary_max) if job.salary_max else None,
                "applicant_count": int(applicants),
                "created_at": job.created_at.isoformat() if job.created_at else None,
            }
        )
    out.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    return out


def list_drive_applications_for_institution(db: Session, institution_id: str, job_id: str) -> list[dict]:
    job = db.get(Job, job_id)
    if not job or not job_assigned_to_institution(job, institution_id):
        return []
    student_ids = institution_student_ids(db, institution_id)
    if not student_ids:
        return []
    apps = db.scalars(
        select(Application)
        .where(
            Application.job_id == job_id,
            Application.student_id.in_(student_ids),
            Application.status != ApplicationStatus.WITHDRAWN.value,
        )
        .order_by(Application.created_at.desc())
    ).all()
    rows: list[dict] = []
    for app in apps:
        student = db.get(User, app.student_id)
        profile = student.student_profile if student else None
        rows.append(
            {
                "id": app.id,
                "student_id": app.student_id,
                "student_name": student.full_name if student else None,
                "student_email": student.email if student else None,
                "program": profile.program if profile else None,
                "cgpa": float(profile.cgpa) if profile and profile.cgpa else None,
                "status": app.status,
                "pipeline_stage": app.pipeline_stage,
                "match_percent": app.match_percent,
                "created_at": app.created_at.isoformat() if app.created_at else None,
            }
        )
    return rows