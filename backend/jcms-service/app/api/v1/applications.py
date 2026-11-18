from datetime import date, datetime

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession, attach_request_id, require_roles
from app.core.exceptions import AppError
from app.core.responses import success_data
from app.models.entities import (
    Application,
    Interview,
    InterviewRescheduleRequest,
    InterviewScorecard,
    Job,
    Offer,
    Organization,
    RecruiterAssignment,
    User,
)
from app.modules.applications import service as app_service
from app.shared.enums import ApplicationStatus, InterviewStatus, OfferStatus, UserRole

router = APIRouter(tags=["applications"])


def _app_error_from_value(e: ValueError) -> AppError:
    code = str(e)
    if code == "FORBIDDEN":
        status = 403
    elif code == "NOT_FOUND":
        status = 404
    else:
        status = 400
    return AppError(code, code.replace("_", " ").title(), status)


class ApplyBody(BaseModel):
    answers: dict = Field(default_factory=dict)
    resume_file_id: str | None = None


class TransitionBody(BaseModel):
    to_status: str
    pipeline_stage: str | None = None
    reason: str | None = None


class RejectBody(BaseModel):
    reason: str | None = None


class NoteBody(BaseModel):
    note: str


class OfferCreateBody(BaseModel):
    role_title: str
    location: str
    annual_package: float
    joining_date: date | None = None
    respond_by: date | None = None
    requires_approval: bool = False
    offer_letter_file_id: str | None = None


class InterviewCreateBody(BaseModel):
    round_name: str
    format: str = "ONLINE"
    starts_at: datetime
    ends_at: datetime
    timezone: str = "Asia/Kolkata"
    meeting_link: str | None = None
    instructions: str | None = None
    panel_user_ids: list[str] = Field(default_factory=list)


class ScorecardBody(BaseModel):
    technical_skills: int = Field(ge=1, le=5)
    problem_solving: int = Field(ge=1, le=5)
    communication: int = Field(ge=1, le=5)
    culture_fit: int = Field(ge=1, le=5)
    comments: str
    recommendation: str


class RescheduleBody(BaseModel):
    starts_at: datetime
    ends_at: datetime
    reason: str | None = None

    @model_validator(mode="after")
    def validate_reschedule(self):
        if self.ends_at <= self.starts_at:
            raise ValueError("ends_at must be after starts_at")
        return self


def _app_dict(db, app: Application) -> dict:
    job = db.get(Job, app.job_id)
    org_name = None
    if job:
        org = db.get(Organization, job.organization_id)
        org_name = org.name if org else None

    student = db.get(User, app.student_id)
    profile = student.student_profile if student else None
    inst = db.get(Organization, profile.institution_id) if profile and profile.institution_id else None

    return {
        "id": app.id,
        "job_id": app.job_id,
        "job_title": job.title if job else None,
        "employer_name": org_name,
        "student_id": app.student_id,
        "student_name": student.full_name if student else None,
        "student_email": student.email if student else None,
        "program": profile.program if profile else None,
        "graduation_year": profile.graduation_year if profile else None,
        "cgpa": float(profile.cgpa) if profile and profile.cgpa else None,
        "location": profile.location if profile else None,
        "skills": profile.skills if profile else [],
        "job_skills": job.skills if job and job.skills else [],
        "institution_name": inst.name if inst else None,
        "status": app.status,
        "pipeline_stage": app.pipeline_stage,
        "match_percent": app.match_percent,
        "answers": app.answers or {},
        "resume_file_id": app.resume_file_id or (profile.resume_file_id if profile else None),
        "internal_note": app.internal_note,
        "rejection_reason": app.rejection_reason,
        "created_at": app.created_at.isoformat() if app.created_at else None,
    }


@router.post("/jobs/{job_id}/applications")
def apply(
    job_id: str,
    body: ApplyBody,
    db: DbSession,
    user: CurrentUser,
    request: Request,
    _: str = Depends(attach_request_id),
):
    require_roles(UserRole.STUDENT)(user)
    job = db.get(Job, job_id)
    if not job:
        raise AppError("NOT_FOUND", "Job not found", 404)
    try:
        app = app_service.submit_application(db, user, job, body.model_dump())
        db.commit()
    except ValueError as e:
        db.rollback()
        code = str(e)
        raise AppError(code, code.replace("_", " ").title(), 409 if code == "DUPLICATE_APPLICATION" else 400)
    return success_data(_app_dict(db, app), request)


@router.get("/applications/me")
def my_applications(db: DbSession, user: CurrentUser, request: Request, _: str = Depends(attach_request_id)):
    require_roles(UserRole.STUDENT)(user)
    apps = db.scalars(
        select(Application).where(Application.student_id == user.id).order_by(Application.created_at.desc())
    ).all()
    return success_data([_app_dict(db, a) for a in apps], request)


@router.get("/applications/{application_id}")
def get_application(
    application_id: str, db: DbSession, user: CurrentUser, request: Request, _: str = Depends(attach_request_id)
):
    app = db.get(Application, application_id)
    if not app:
        raise AppError("NOT_FOUND", "Not found", 404)
    if user.role == UserRole.STUDENT.value and app.student_id != user.id:
        raise AppError("FORBIDDEN", "Forbidden", 403)
    if user.role in (UserRole.RECRUITER.value, UserRole.EMPLOYER.value):
        try:
            app_service._assert_recruiter_or_employer(db, app, user)
        except ValueError:
            raise AppError("FORBIDDEN", "Forbidden", 403)
    data = _app_dict(db, app)
    if user.role == UserRole.STUDENT.value:
        data["internal_note"] = None
    return success_data(data, request)


@router.post("/applications/{application_id}/shortlist")
def shortlist(
    application_id: str, db: DbSession, user: CurrentUser, request: Request, _: str = Depends(attach_request_id)
):
    app = db.get(Application, application_id)
    if not app:
        raise AppError("NOT_FOUND", "Not found", 404)
    try:
        app_service.transition_application(
            db,
            app,
            user,
            to_status=ApplicationStatus.SHORTLISTED.value,
            pipeline_stage="Shortlisted",
        )
        db.commit()
    except ValueError as e:
        db.rollback()
        raise _app_error_from_value(e)
    return success_data(_app_dict(db, app), request)


@router.post("/applications/{application_id}/reject")
def reject_app(
    application_id: str,
    body: RejectBody,
    db: DbSession,
    user: CurrentUser,
    request: Request,
    _: str = Depends(attach_request_id),
):
    app = db.get(Application, application_id)
    if not app:
        raise AppError("NOT_FOUND", "Not found", 404)
    try:
        app_service.transition_application(
            db,
            app,
            user,
            to_status=ApplicationStatus.REJECTED.value,
            reason=body.reason or "Candidate not moving forward",
        )
        db.commit()
    except ValueError as e:
        db.rollback()
        raise _app_error_from_value(e)
    return success_data(_app_dict(db, app), request)


@router.post("/applications/{application_id}/screen")
def to_screening(
    application_id: str, db: DbSession, user: CurrentUser, request: Request, _: str = Depends(attach_request_id)
):
    app = db.get(Application, application_id)
    if not app:
        raise AppError("NOT_FOUND", "Not found", 404)
    try:
        app_service.transition_application(
            db, app, user, to_status=ApplicationStatus.SCREENING.value, pipeline_stage="Screening"
        )
        db.commit()
    except ValueError as e:
        db.rollback()
        raise _app_error_from_value(e)
    return success_data(_app_dict(db, app), request)


@router.post("/applications/{application_id}/hold")
def to_hold(
    application_id: str, db: DbSession, user: CurrentUser, request: Request, _: str = Depends(attach_request_id)
):
    app = db.get(Application, application_id)
    if not app:
        raise AppError("NOT_FOUND", "Not found", 404)
    try:
        app_service.transition_application(
            db, app, user, to_status=ApplicationStatus.ON_HOLD.value, pipeline_stage="On Hold"
        )
        db.commit()
    except ValueError as e:
        db.rollback()
        raise _app_error_from_value(e)
    return success_data(_app_dict(db, app), request)


@router.post("/applications/{application_id}/transition")
def transition_stage(
    application_id: str,
    body: TransitionBody,
    db: DbSession,
    user: CurrentUser,
    request: Request,
    _: str = Depends(attach_request_id),
):
    app = db.get(Application, application_id)
    if not app:
        raise AppError("NOT_FOUND", "Not found", 404)
    try:
        app_service.transition_application(
            db,
            app,
            user,
            to_status=body.to_status,
            pipeline_stage=body.pipeline_stage or body.to_status.title(),
            reason=body.reason,
        )
        db.commit()
    except ValueError as e:
        db.rollback()
        raise AppError(str(e), str(e), 400)
    return success_data(_app_dict(db, app), request)


@router.post("/applications/{application_id}/note")
def save_application_note(
    application_id: str,
    body: NoteBody,
    db: DbSession,
    user: CurrentUser,
    request: Request,
    _: str = Depends(attach_request_id),
):
    app = db.get(Application, application_id)
    if not app:
        raise AppError("NOT_FOUND", "Not found", 404)
    try:
        app_service._assert_recruiter_or_employer(db, app, user)
    except ValueError:
        raise AppError("FORBIDDEN", "Forbidden", 403)
    app.internal_note = body.note
    from app.modules.audit.service import record_audit

    record_audit(
        db,
        actor_id=user.id,
        action="application.note.update",
        resource_type="application",
        resource_id=app.id,
        metadata={"note_length": len(body.note or "")},
    )
    db.commit()
    return success_data({"status": "saved", "internal_note": app.internal_note}, request)


@router.get("/recruiter/applications")
def recruiter_queue(
    db: DbSession,
    user: CurrentUser,
    request: Request,
    job_id: str | None = None,
    status: str | None = None,
    _: str = Depends(attach_request_id),
):
    require_roles(UserRole.RECRUITER, UserRole.EMPLOYER)(user)

    if user.role == UserRole.RECRUITER.value:
        job_ids = list(
            db.scalars(select(RecruiterAssignment.job_id).where(RecruiterAssignment.recruiter_id == user.id)).all()
        )
    else:
        # Employer sees all applications for their organization's jobs
        job_ids = list(
            db.scalars(select(Job.id).where(Job.organization_id == user.organization_id)).all()
        )

    if not job_ids:
        return success_data([], request)

    stmt = select(Application).where(Application.job_id.in_(job_ids))
    if job_id:
        stmt = stmt.where(Application.job_id == job_id)
    if status:
        stmt = stmt.where(Application.status == status)
    else:
        # Default queue shows active applicants
        stmt = stmt.where(
            Application.status.in_(
                [
                    ApplicationStatus.SUBMITTED.value,
                    ApplicationStatus.SCREENING.value,
                    ApplicationStatus.SHORTLISTED.value,
                    ApplicationStatus.ASSESSMENT.value,
                    ApplicationStatus.INTERVIEW_SCHEDULED.value,
                    ApplicationStatus.ON_HOLD.value,
                ]
            )
        )
    stmt = stmt.order_by(Application.created_at.desc())
    apps = db.scalars(stmt).all()
    return success_data([_app_dict(db, a) for a in apps], request)


@router.post("/applications/{application_id}/interviews")
def schedule_interview(
    application_id: str,
    body: InterviewCreateBody,
    db: DbSession,
    user: CurrentUser,
    request: Request,
    _: str = Depends(attach_request_id),
):
    app = db.get(Application, application_id)
    if not app:
        raise AppError("NOT_FOUND", "Not found", 404)
    try:
        app_service._assert_recruiter_or_employer(db, app, user)
    except ValueError:
        raise AppError("FORBIDDEN", "Forbidden", 403)

    try:
        interview = app_service.schedule_interview(
            db,
            app,
            user,
            round_name=body.round_name,
            format=body.format,
            starts_at=body.starts_at,
            ends_at=body.ends_at,
            timezone=body.timezone,
            meeting_link=body.meeting_link,
            instructions=body.instructions,
            panel_user_ids=body.panel_user_ids or [user.id],
        )
        db.commit()
    except ValueError as e:
        db.rollback()
        raise AppError(str(e), str(e), 400)
    return success_data({"id": interview.id, "status": interview.status}, request)


@router.get("/recruiter/interviews")
def list_recruiter_interviews(
    db: DbSession, user: CurrentUser, request: Request, _: str = Depends(attach_request_id)
):
    require_roles(UserRole.RECRUITER, UserRole.EMPLOYER)(user)
    if user.role == UserRole.RECRUITER.value:
        job_ids = list(
            db.scalars(select(RecruiterAssignment.job_id).where(RecruiterAssignment.recruiter_id == user.id)).all()
        )
    elif user.organization_id:
        job_ids = list(
            db.scalars(select(Job.id).where(Job.organization_id == user.organization_id)).all()
        )
    else:
        job_ids = []

    app_ids = list(
        db.scalars(select(Application.id).where(Application.job_id.in_(job_ids or ["none"]))).all()
    )
    interviews = db.scalars(
        select(Interview).where(Interview.application_id.in_(app_ids or ["none"])).order_by(Interview.starts_at.desc())
    ).all()

    out = []
    for i in interviews:
        app = db.get(Application, i.application_id)
        job = db.get(Job, app.job_id) if app else None
        student = db.get(User, app.student_id) if app else None
        sc = i.scorecard
        out.append(
            {
                "id": i.id,
                "application_id": i.application_id,
                "student_name": student.full_name if student else None,
                "job_title": job.title if job else None,
                "round_name": i.round_name,
                "format": i.format,
                "starts_at": i.starts_at.isoformat(),
                "ends_at": i.ends_at.isoformat(),
                "timezone": i.timezone,
                "meeting_link": i.meeting_link,
                "instructions": i.instructions,
                "status": i.status,
                "scorecard": {
                    "id": sc.id,
                    "technical_skills": sc.technical_skills,
                    "problem_solving": sc.problem_solving,
                    "communication": sc.communication,
                    "culture_fit": sc.culture_fit,
                    "comments": sc.comments,
                    "recommendation": sc.recommendation,
                }
                if sc
                else None,
            }
        )
    return success_data(out, request)


@router.post("/interviews/{interview_id}/feedback")
def submit_feedback(
    interview_id: str,
    body: ScorecardBody,
    db: DbSession,
    user: CurrentUser,
    request: Request,
    _: str = Depends(attach_request_id),
):
    interview = db.get(Interview, interview_id)
    if not interview:
        raise AppError("NOT_FOUND", "Not found", 404)
    app = db.get(Application, interview.application_id)
    if not app:
        raise AppError("NOT_FOUND", "Not found", 404)
    try:
        app_service._assert_recruiter_or_employer(db, app, user)
    except ValueError:
        raise AppError("FORBIDDEN", "Forbidden", 403)

    try:
        sc = app_service.submit_interview_feedback(
            db,
            interview,
            user,
            technical_skills=body.technical_skills,
            problem_solving=body.problem_solving,
            communication=body.communication,
            culture_fit=body.culture_fit,
            comments=body.comments,
            recommendation=body.recommendation,
        )
        db.commit()
    except ValueError as e:
        db.rollback()
        raise AppError(str(e), str(e), 400)
    return success_data({"id": sc.id, "status": interview.status}, request)


@router.get("/interviews/me")
def my_interviews(db: DbSession, user: CurrentUser, request: Request, _: str = Depends(attach_request_id)):
    require_roles(UserRole.STUDENT)(user)
    apps = db.scalars(select(Application).where(Application.student_id == user.id)).all()
    app_ids = [a.id for a in apps]
    interviews = db.scalars(
        select(Interview).where(Interview.application_id.in_(app_ids or ["none"])).order_by(Interview.starts_at.asc())
    ).all()
    out = []
    for i in interviews:
        app = db.get(Application, i.application_id)
        job = db.get(Job, app.job_id) if app else None
        org = db.get(Organization, job.organization_id) if job else None
        out.append(
            {
                "id": i.id,
                "round_name": i.round_name,
                "starts_at": i.starts_at.isoformat(),
                "ends_at": i.ends_at.isoformat(),
                "meeting_link": i.meeting_link,
                "instructions": i.instructions,
                "status": i.status,
                "job_title": job.title if job else None,
                "company_name": org.name if org else None,
                "outcome": i.outcome,
            }
        )
    return success_data(out, request)


@router.post("/applications/{application_id}/offers")
def create_offer(
    application_id: str,
    body: OfferCreateBody,
    db: DbSession,
    user: CurrentUser,
    request: Request,
    _: str = Depends(attach_request_id),
):
    app = db.get(Application, application_id)
    if not app:
        raise AppError("NOT_FOUND", "Not found", 404)
    try:
        offer = app_service.create_offer(db, app, user, body.model_dump())
        db.commit()
    except ValueError as e:
        db.rollback()
        code = str(e)
        raise AppError(code, code, 400 if code.startswith("INVALID_") else 403)
    return success_data({"id": offer.id, "status": offer.status}, request)


@router.post("/offers/{offer_id}/approve")
def approve_offer_endpoint(
    offer_id: str, db: DbSession, user: CurrentUser, request: Request, _: str = Depends(attach_request_id)
):
    offer = db.get(Offer, offer_id)
    if not offer:
        raise AppError("NOT_FOUND", "Offer not found", 404)
    try:
        app_service.approve_offer(db, offer, user)
        db.commit()
    except ValueError as e:
        db.rollback()
        raise AppError(str(e), str(e), 400)
    return success_data({"id": offer.id, "status": offer.status}, request)


@router.get("/offers/me")
def my_offers(db: DbSession, user: CurrentUser, request: Request, _: str = Depends(attach_request_id)):
    require_roles(UserRole.STUDENT)(user)
    apps = db.scalars(select(Application).where(Application.student_id == user.id)).all()
    app_ids = [a.id for a in apps]
    offers = db.scalars(
        select(Offer).where(Offer.application_id.in_(app_ids or ["none"])).order_by(Offer.created_at.desc())
    ).all()
    out = []
    for o in offers:
        app = db.get(Application, o.application_id)
        job = db.get(Job, app.job_id) if app else None
        org = db.get(Organization, job.organization_id) if job else None
        out.append(
            {
                "id": o.id,
                "status": o.status,
                "role_title": o.role_title,
                "company_name": org.name if org else None,
                "location": o.location,
                "annual_package": float(o.annual_package),
                "joining_date": o.joining_date.isoformat() if o.joining_date else None,
                "respond_by": o.respond_by.isoformat() if o.respond_by else None,
                "offer_letter_file_id": o.offer_letter_file_id,
            }
        )
    return success_data(out, request)


class OfferRespondBody(BaseModel):
    accept: bool


class WithdrawBody(BaseModel):
    reason: str | None = None


@router.post("/applications/{application_id}/withdraw")
def withdraw_application(
    application_id: str,
    db: DbSession,
    user: CurrentUser,
    request: Request,
    body: WithdrawBody | None = None,
    _: str = Depends(attach_request_id),
):
    require_roles(UserRole.STUDENT)(user)
    app = db.get(Application, application_id)
    if not app:
        raise AppError("NOT_FOUND", "Not found", 404)
    try:
        app_service.withdraw_application(db, app, user, reason=(body.reason if body else None))
        db.commit()
    except ValueError as e:
        db.rollback()
        raise AppError(str(e), str(e), 400 if str(e) != "FORBIDDEN" else 403)
    return success_data(_app_dict(db, app), request)


@router.post("/interviews/{interview_id}/reschedule-request")
def reschedule_request(
    interview_id: str,
    body: RescheduleBody,
    db: DbSession,
    user: CurrentUser,
    request: Request,
    _: str = Depends(attach_request_id),
):
    require_roles(UserRole.STUDENT)(user)
    interview = db.get(Interview, interview_id)
    if not interview:
        raise AppError("NOT_FOUND", "Not found", 404)
    try:
        req = app_service.request_interview_reschedule(
            db,
            interview,
            user,
            starts_at=body.starts_at,
            ends_at=body.ends_at,
            reason=body.reason,
        )
        db.commit()
    except ValueError as e:
        db.rollback()
        raise AppError(str(e), str(e), 400)
    return success_data({"id": req.id, "status": req.status}, request)


class RescheduleRespondBody(BaseModel):
    approve: bool
    comment: str | None = None


@router.post("/interviews/reschedule-requests/{request_id}/respond")
def respond_reschedule(
    request_id: str,
    body: RescheduleRespondBody,
    db: DbSession,
    user: CurrentUser,
    request: Request,
    _: str = Depends(attach_request_id),
):
    req = db.get(InterviewRescheduleRequest, request_id)
    if not req:
        raise AppError("NOT_FOUND", "Not found", 404)
    try:
        app_service.respond_interview_reschedule(db, req, user, approve=body.approve, comment=body.comment)
        db.commit()
    except ValueError as e:
        db.rollback()
        raise AppError(str(e), str(e), 400 if str(e) != "FORBIDDEN" else 403)
    return success_data({"status": req.status}, request)


def _recruiter_job_ids(db, user: User) -> list[str]:
    if user.role == UserRole.RECRUITER.value:
        return list(
            db.scalars(
                select(RecruiterAssignment.job_id).where(RecruiterAssignment.recruiter_id == user.id)
            ).all()
        )
    if user.organization_id:
        return list(db.scalars(select(Job.id).where(Job.organization_id == user.organization_id)).all())
    return []


@router.get("/recruiter/reschedule-requests")
def list_reschedule_requests(
    db: DbSession, user: CurrentUser, request: Request, _: str = Depends(attach_request_id)
):
    require_roles(UserRole.RECRUITER, UserRole.EMPLOYER)(user)
    job_ids = _recruiter_job_ids(db, user)
    app_ids = list(
        db.scalars(select(Application.id).where(Application.job_id.in_(job_ids or ["none"]))).all()
    )
    interview_ids = list(
        db.scalars(
            select(Interview.id).where(Interview.application_id.in_(app_ids or ["none"]))
        ).all()
    )
    reqs = db.scalars(
        select(InterviewRescheduleRequest)
        .where(
            InterviewRescheduleRequest.interview_id.in_(interview_ids or ["none"]),
            InterviewRescheduleRequest.status == "PENDING",
        )
        .order_by(InterviewRescheduleRequest.created_at.desc())
    ).all()
    out = []
    for req in reqs:
        interview = db.get(Interview, req.interview_id)
        app = db.get(Application, interview.application_id) if interview else None
        job = db.get(Job, app.job_id) if app else None
        student = db.get(User, req.student_id)
        out.append(
            {
                "id": req.id,
                "interview_id": req.interview_id,
                "student_name": student.full_name if student else None,
                "job_title": job.title if job else None,
                "round_name": interview.round_name if interview else None,
                "current_starts_at": interview.starts_at.isoformat() if interview else None,
                "requested_starts_at": req.requested_starts_at.isoformat(),
                "requested_ends_at": req.requested_ends_at.isoformat(),
                "reason": req.reason,
                "status": req.status,
            }
        )
    return success_data(out, request)


@router.post("/offers/{offer_id}/respond")
def respond_offer(
    offer_id: str,
    body: OfferRespondBody,
    db: DbSession,
    user: CurrentUser,
    request: Request,
    _: str = Depends(attach_request_id),
):
    offer = db.get(Offer, offer_id)
    if not offer:
        raise AppError("NOT_FOUND", "Not found", 404)
    try:
        app_service.respond_offer(db, offer, user, body.accept)
        db.commit()
    except ValueError as e:
        db.rollback()
        raise AppError(str(e), str(e), 400)
    return success_data({"status": offer.status}, request)
