from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.entities import (
    Application,
    ApplicationStatusEvent,
    Job,
    Offer,
    Placement,
    User,
)
from app.modules.audit.service import record_audit
from app.modules.eligibility.service import evaluate_eligibility
from app.modules.notifications.service import notify_user, notify_users_for_job
from app.shared.enums import (
    ApplicationStatus,
    EligibilityResult,
    JobStatus,
    OfferStatus,
    PlacementStatus,
    UserRole,
)

_PIPELINE_HIDDEN_STATUSES = frozenset(
    {
        ApplicationStatus.REJECTED.value,
        ApplicationStatus.WITHDRAWN.value,
    }
)


def normalize_application_status(status: str | None) -> str:
    """Uppercase status for comparisons (tolerates legacy casing in stored rows)."""
    return (status or ApplicationStatus.SUBMITTED.value).strip().upper()


def _normalize_offer_status(status: str | None) -> str:
    return (status or OfferStatus.DRAFT.value).strip().upper()


_RESPONDABLE_OFFER_STATUSES = frozenset(
    {
        OfferStatus.ISSUED.value,
        OfferStatus.PENDING_APPROVAL.value,
        OfferStatus.APPROVED.value,
    }
)


def _student_owns_application(db: Session, student: User, app: Application) -> bool:
    if app.student_id == student.id:
        return True
    owner = db.get(User, app.student_id)
    if owner and owner.email and student.email and owner.email.strip().lower() == student.email.strip().lower():
        app.student_id = student.id
        return True
    return False


def relink_applications_to_lms_user(db: Session, student: User) -> int:
    """Heal applications still tied to a legacy JCMS user row with the same email as the LMS account."""
    if (student.role or "").strip().upper() != UserRole.STUDENT.value or not student.email:
        return 0
    email_l = student.email.strip().lower()
    legacy_ids = list(
        db.scalars(
            select(User.id).where(
                User.id != student.id,
                func.lower(User.email) == email_l,
            )
        ).all()
    )
    if not legacy_ids:
        return 0
    count = 0
    for app in db.scalars(select(Application).where(Application.student_id.in_(legacy_ids))).all():
        app.student_id = student.id
        count += 1
    return count


def _ensure_respond_by_deadline(raw: date | None) -> date:
    today = date.today()
    if raw is None or raw < today:
        return today + timedelta(days=14)
    return raw


def refresh_open_offer_deadlines(db: Session, offers: list[Offer]) -> int:
    """Offers created with past default dates can be responded to after the student opens the page."""
    today = date.today()
    updated = 0
    for offer in offers:
        st = _normalize_offer_status(offer.status)
        if st not in _RESPONDABLE_OFFER_STATUSES and st != OfferStatus.EXPIRED.value:
            continue
        if st == OfferStatus.EXPIRED.value:
            offer.status = OfferStatus.ISSUED.value
            offer.respond_by = today + timedelta(days=14)
            updated += 1
            continue
        if offer.respond_by is None or offer.respond_by < today:
            offer.respond_by = today + timedelta(days=14)
            updated += 1
    return updated


def prepare_offer_for_student_response(db: Session, offer: Offer) -> None:
    """Align offer row with what the student UI shows (issued & open for response)."""
    st = _normalize_offer_status(offer.status)
    if st in (
        OfferStatus.EXPIRED.value,
        OfferStatus.PENDING_APPROVAL.value,
        OfferStatus.APPROVED.value,
    ):
        offer.status = OfferStatus.ISSUED.value
        offer.requires_approval = False
    refresh_open_offer_deadlines(db, [offer])


def application_visible_in_employer_pipeline(app: Application) -> bool:
    return normalize_application_status(app.status) not in _PIPELINE_HIDDEN_STATUSES


def submit_application(db: Session, student: User, job: Job, data: dict) -> Application:
    if student.role != UserRole.STUDENT.value:
        raise ValueError("FORBIDDEN")
    if job.status != JobStatus.PUBLISHED.value:
        raise ValueError("JOB_NOT_ACCEPTING")
    if job.closes_on and job.closes_on < date.today():
        raise ValueError("JOB_CLOSED")
    # Allow reapply only when prior apps for this job are WITHDRAWN (new application id).
    active = db.scalar(
        select(Application).where(
            Application.job_id == job.id,
            Application.student_id == student.id,
            Application.status != ApplicationStatus.WITHDRAWN.value,
        )
    )
    if active:
        raise ValueError("DUPLICATE_APPLICATION")

    ev = evaluate_eligibility(db, job, student)
    if ev.result == EligibilityResult.NOT_ELIGIBLE.value:
        raise ValueError("NOT_ELIGIBLE")

    profile = student.student_profile
    resume_file_id = data.get("resume_file_id")
    if resume_file_id:
        resume_file_id = str(resume_file_id).strip() or None
    if not resume_file_id and profile and profile.resume_file_id:
        resume_file_id = profile.resume_file_id
    if not resume_file_id:
        raise ValueError("RESUME_REQUIRED")

    app = Application(
        job_id=job.id,
        student_id=student.id,
        status=ApplicationStatus.SUBMITTED.value,
        pipeline_stage="Screening",
        match_percent=ev.match_percent,
        answers=data.get("answers", {}),
        resume_file_id=resume_file_id,
    )
    db.add(app)
    db.flush()
    db.add(
        ApplicationStatusEvent(
            application_id=app.id,
            from_status=None,
            to_status=ApplicationStatus.SUBMITTED.value,
            actor_id=student.id,
        )
    )
    notify_user(
        db,
        user_id=student.id,
        title="Application submitted",
        body=f"You applied to {job.title}.",
        resource_type="application",
        resource_id=app.id,
        outbox_type="application.submitted",
    )
    from app.models.entities import RecruiterAssignment

    hiring_team = db.scalars(
        select(User).where(
            User.organization_id == job.organization_id,
            User.role == UserRole.EMPLOYER.value,
        )
    ).all()
    for member in hiring_team:
        notify_user(
            db,
            user_id=member.id,
            title="New application received",
            body=f"New applicant for {job.title} (resume attached).",
            resource_type="application",
            resource_id=app.id,
        )
    campus_heads: list[User] = []
    if job.campus_institution_id:
        campus_heads = list(
            db.scalars(
                select(User).where(
                    User.organization_id == job.campus_institution_id,
                    User.role == UserRole.INSTITUTION.value,
                )
            ).all()
        )
    for head in campus_heads:
        notify_user(
            db,
            user_id=head.id,
            title="Campus application received",
            body=f"A student applied to campus role {job.title} (resume attached).",
            resource_type="application",
            resource_id=app.id,
        )
    record_audit(
        db,
        actor_id=student.id,
        action="application.submit",
        resource_type="application",
        resource_id=app.id,
    )
    return app


def transition_application(
    db: Session,
    app: Application,
    actor: User,
    *,
    to_status: str,
    pipeline_stage: str | None = None,
    reason: str | None = None,
) -> Application:
    _assert_recruiter_or_employer(db, app, actor)
    current = (app.status or ApplicationStatus.SUBMITTED.value).strip().upper()

    if to_status == ApplicationStatus.REJECTED.value:
        if current == ApplicationStatus.REJECTED.value:
            if reason:
                app.rejection_reason = reason.strip()
            return app
        if current == ApplicationStatus.WITHDRAWN.value:
            raise ValueError("INVALID_TRANSITION")
    else:
        allowed = _allowed_transitions(current)
        if to_status not in allowed:
            raise ValueError("INVALID_TRANSITION")
    prev = app.status
    app.status = to_status
    if pipeline_stage:
        app.pipeline_stage = pipeline_stage
    if to_status == ApplicationStatus.REJECTED.value:
        app.rejection_reason = (reason or "Candidate not moving forward").strip()
        app.pipeline_stage = "Rejected"
    db.add(
        ApplicationStatusEvent(
            application_id=app.id,
            from_status=prev,
            to_status=to_status,
            actor_id=actor.id,
            reason=reason,
        )
    )
    notify_user(
        db,
        user_id=app.student_id,
        title="Application update",
        body=f"Your application status is now {to_status.replace('_', ' ').title()}.",
        resource_type="application",
        resource_id=app.id,
    )
    if to_status in (ApplicationStatus.REJECTED.value, ApplicationStatus.SHORTLISTED.value, ApplicationStatus.WITHDRAWN.value):
        job = db.get(Job, app.job_id)
        if job:
            from app.models.entities import RecruiterAssignment

            recruiter_ids = list(
                db.scalars(
                    select(RecruiterAssignment.recruiter_id).where(RecruiterAssignment.job_id == job.id)
                ).all()
            )
            student = db.get(User, app.student_id)
            sname = student.full_name if student else "Candidate"
            notify_users_for_job(
                db,
                job_id=job.id,
                recruiter_ids=recruiter_ids,
                title=f"Application {to_status.lower()}",
                body=f"{sname} — {job.title}: {to_status}.",
                resource_type="application",
                resource_id=app.id,
            )
    record_audit(
        db,
        actor_id=actor.id,
        action="application.transition",
        resource_type="application",
        resource_id=app.id,
        metadata={"from": prev, "to": to_status},
    )
    return app


def _allowed_transitions(current: str) -> set[str]:
    graph = {
        ApplicationStatus.SUBMITTED.value: {
            ApplicationStatus.SCREENING.value,
            ApplicationStatus.SHORTLISTED.value,
            ApplicationStatus.REJECTED.value,
            ApplicationStatus.WITHDRAWN.value,
        },
        ApplicationStatus.SCREENING.value: {
            ApplicationStatus.SHORTLISTED.value,
            ApplicationStatus.ASSESSMENT.value,
            ApplicationStatus.INTERVIEW_SCHEDULED.value,
            ApplicationStatus.REJECTED.value,
            ApplicationStatus.ON_HOLD.value,
        },
        ApplicationStatus.SHORTLISTED.value: {
            ApplicationStatus.SCREENING.value,
            ApplicationStatus.ASSESSMENT.value,
            ApplicationStatus.INTERVIEW_SCHEDULED.value,
            ApplicationStatus.SELECTED.value,
            ApplicationStatus.REJECTED.value,
            ApplicationStatus.ON_HOLD.value,
        },
        ApplicationStatus.ASSESSMENT.value: {
            ApplicationStatus.SHORTLISTED.value,
            ApplicationStatus.INTERVIEW_SCHEDULED.value,
            ApplicationStatus.SELECTED.value,
            ApplicationStatus.REJECTED.value,
            ApplicationStatus.ON_HOLD.value,
        },
        ApplicationStatus.INTERVIEW_SCHEDULED.value: {
            ApplicationStatus.UNDER_EMPLOYER_REVIEW.value,
            ApplicationStatus.SELECTED.value,
            ApplicationStatus.SHORTLISTED.value,
            ApplicationStatus.INTERVIEW_IN_PROGRESS.value,
            ApplicationStatus.REJECTED.value,
            ApplicationStatus.ON_HOLD.value,
        },
        ApplicationStatus.INTERVIEW_IN_PROGRESS.value: {
            ApplicationStatus.UNDER_EMPLOYER_REVIEW.value,
            ApplicationStatus.SELECTED.value,
            ApplicationStatus.INTERVIEW_SCHEDULED.value,
            ApplicationStatus.REJECTED.value,
            ApplicationStatus.ON_HOLD.value,
        },
        ApplicationStatus.UNDER_EMPLOYER_REVIEW.value: {
            ApplicationStatus.SELECTED.value,
            ApplicationStatus.REJECTED.value,
            ApplicationStatus.ON_HOLD.value,
        },
        ApplicationStatus.ON_HOLD.value: {
            ApplicationStatus.SCREENING.value,
            ApplicationStatus.SHORTLISTED.value,
            ApplicationStatus.INTERVIEW_SCHEDULED.value,
            ApplicationStatus.REJECTED.value,
        },
        ApplicationStatus.SELECTED.value: {
            ApplicationStatus.REJECTED.value,
            # Withdrawal blocked when offer issued — see withdraw_application offer check.
            ApplicationStatus.WITHDRAWN.value,
        },
        ApplicationStatus.REJECTED.value: set(),
        ApplicationStatus.WITHDRAWN.value: set(),
    }
    terminal = {ApplicationStatus.REJECTED.value, ApplicationStatus.WITHDRAWN.value}
    if current in terminal:
        return set()
    allowed = graph.get(current)
    if allowed is None:
        return {ApplicationStatus.REJECTED.value, ApplicationStatus.ON_HOLD.value}
    return allowed


def _assert_recruiter_or_employer(db: Session, app: Application, user: User) -> None:
    from app.modules.jobs.service import _assert_job_access

    job = db.get(Job, app.job_id)
    if not job:
        raise ValueError("NOT_FOUND")
    _assert_job_access(db, job, user)


def create_offer(db: Session, app: Application, actor: User, data: dict) -> Offer:
    _assert_recruiter_or_employer(db, app, actor)
    if data.get("annual_package") is not None and float(data["annual_package"]) < 0:
        raise ValueError("INVALID_ANNUAL_PACKAGE")
    if data.get("respond_by") and data.get("joining_date") and data["respond_by"] > data["joining_date"]:
        raise ValueError("INVALID_RESPOND_BY_DATE")
    # Single employer seat per company — offers go straight to the student (no internal approval chain).
    requires_approval = False
    status = OfferStatus.ISSUED.value
    respond_by = _ensure_respond_by_deadline(data.get("respond_by"))
    offer = Offer(
        application_id=app.id,
        role_title=data["role_title"],
        location=data["location"],
        annual_package=data["annual_package"],
        joining_date=data.get("joining_date"),
        respond_by=respond_by,
        requires_approval=requires_approval,
        status=status,
        offer_letter_file_id=data.get("offer_letter_file_id"),
    )
    if offer.status == OfferStatus.ISSUED.value:
        app.status = ApplicationStatus.SELECTED.value
        app.pipeline_stage = "Selected"
    db.add(offer)
    db.flush()
    notify_user(
        db,
        user_id=app.student_id,
        title="Offer issued",
        body=f"Offer for {data['role_title']}.",
        resource_type="offer",
        resource_id=offer.id,
    )
    record_audit(db, actor_id=actor.id, action="offer.create", resource_type="offer", resource_id=offer.id)
    return offer


def approve_offer(db: Session, offer: Offer, actor: User) -> Offer:
    if actor.role != UserRole.EMPLOYER.value:
        raise ValueError("FORBIDDEN")
    app = db.get(Application, offer.application_id)
    if not app:
        raise ValueError("NOT_FOUND")
    from app.modules.jobs.service import _assert_job_owner
    job = db.get(Job, app.job_id)
    if not job:
        raise ValueError("NOT_FOUND")
    _assert_job_owner(db, job, actor)
    if offer.status not in (OfferStatus.PENDING_APPROVAL.value, OfferStatus.DRAFT.value):
        raise ValueError("INVALID_STATE")
    offer.status = OfferStatus.ISSUED.value
    app.status = ApplicationStatus.SELECTED.value
    app.pipeline_stage = "Selected"
    notify_user(
        db,
        user_id=app.student_id,
        title="Offer issued",
        body=f"Your offer for '{offer.role_title}' is ready for review.",
        resource_type="offer",
        resource_id=offer.id,
    )
    record_audit(db, actor_id=actor.id, action="offer.approve", resource_type="offer", resource_id=offer.id)
    return offer


def auto_issue_pending_offers_for_org(db: Session, actor: User) -> int:
    """Legacy rows only — solo employer model no longer uses internal approval."""
    if actor.role != UserRole.EMPLOYER.value or not actor.organization_id:
        return 0
    job_ids = list(db.scalars(select(Job.id).where(Job.organization_id == actor.organization_id)).all())
    if not job_ids:
        return 0
    app_ids = list(db.scalars(select(Application.id).where(Application.job_id.in_(job_ids))).all())
    if not app_ids:
        return 0
    offers = db.scalars(
        select(Offer).where(
            Offer.application_id.in_(app_ids),
            Offer.status == OfferStatus.PENDING_APPROVAL.value,
        )
    ).all()
    count = 0
    for offer in offers:
        try:
            approve_offer(db, offer, actor)
            count += 1
        except ValueError:
            continue
    return count


def respond_offer(db: Session, offer: Offer, student: User, accept: bool) -> Offer:
    relink_applications_to_lms_user(db, student)
    app = db.get(Application, offer.application_id)
    if not app or not _student_owns_application(db, student, app):
        raise ValueError("FORBIDDEN")
    prepare_offer_for_student_response(db, offer)
    st = _normalize_offer_status(offer.status)
    if st == OfferStatus.ACCEPTED.value:
        raise ValueError("ALREADY_ACCEPTED")
    if st == OfferStatus.DECLINED.value:
        raise ValueError("ALREADY_DECLINED")
    if st not in _RESPONDABLE_OFFER_STATUSES:
        raise ValueError("INVALID_STATE")
    if offer.respond_by and offer.respond_by < date.today():
        offer.respond_by = date.today() + timedelta(days=14)
    offer.status = OfferStatus.ACCEPTED.value if accept else OfferStatus.DECLINED.value
    if accept and app:
        existing_p = db.scalar(select(Placement).where(Placement.application_id == app.id))
        if not existing_p:
            profile = student.student_profile
            inst_id = profile.institution_id if profile else None
            placement = Placement(
                application_id=app.id,
                student_id=app.student_id,
                institution_id=inst_id,
                offer_id=offer.id,
                designation=offer.role_title,
                annual_package=offer.annual_package,
                work_location=offer.location,
                joining_date=offer.joining_date,
                status=PlacementStatus.PENDING_DETAILS.value,
            )
            db.add(placement)
    job = db.get(Job, app.job_id) if app else None
    if job:
        employer = db.scalar(
            select(User).where(User.organization_id == job.organization_id, User.role == UserRole.EMPLOYER.value)
        )
        if employer:
            notify_user(
                db,
                user_id=employer.id,
                title="Offer " + ("accepted" if accept else "declined"),
                body=f"Student responded to offer for {offer.role_title}.",
                resource_type="offer",
                resource_id=offer.id,
            )
    notify_user(
        db,
        user_id=student.id,
        title="Offer " + ("accepted" if accept else "declined"),
        body="Your response has been recorded.",
        resource_type="offer",
        resource_id=offer.id,
    )
    record_audit(
        db,
        actor_id=student.id,
        action="offer.accept" if accept else "offer.decline",
        resource_type="offer",
        resource_id=offer.id,
    )
    return offer


def withdraw_application(
    db: Session, app: Application, student: User, *, reason: str | None = None
) -> Application:
    if student.id != app.student_id:
        raise ValueError("FORBIDDEN")
    if app.status == ApplicationStatus.WITHDRAWN.value:
        raise ValueError("ALREADY_WITHDRAWN")
    if app.status == ApplicationStatus.REJECTED.value:
        raise ValueError("WITHDRAW_NOT_ALLOWED")
    # Offers: once issued/accepted/pending approval, use offer respond flow — not withdraw.
    blocking_offer = db.scalar(
        select(Offer).where(
            Offer.application_id == app.id,
            Offer.status.in_(
                [
                    OfferStatus.ISSUED.value,
                    OfferStatus.ACCEPTED.value,
                    OfferStatus.PENDING_APPROVAL.value,
                    OfferStatus.APPROVED.value,
                ]
            ),
        )
    )
    if blocking_offer:
        raise ValueError("OFFER_IN_PROGRESS")
    allowed = _allowed_transitions(app.status)
    if ApplicationStatus.WITHDRAWN.value not in allowed:
        raise ValueError("WITHDRAW_NOT_ALLOWED")
    if reason is not None and len(reason) > 2000:
        raise ValueError("REASON_TOO_LONG")
    prev = app.status
    app.status = ApplicationStatus.WITHDRAWN.value
    app.pipeline_stage = "Withdrawn"
    db.add(
        ApplicationStatusEvent(
            application_id=app.id,
            from_status=prev,
            to_status=ApplicationStatus.WITHDRAWN.value,
            actor_id=student.id,
            reason=reason or "Withdrawn by student",
        )
    )
    notify_user(
        db,
        user_id=student.id,
        title="Application withdrawn",
        body="You withdrew your application.",
        resource_type="application",
        resource_id=app.id,
    )
    job = db.get(Job, app.job_id)
    if job:
        from app.models.entities import RecruiterAssignment

        recruiter_ids = list(
            db.scalars(select(RecruiterAssignment.recruiter_id).where(RecruiterAssignment.job_id == job.id)).all()
        )
        notify_users_for_job(
            db,
            job_id=job.id,
            recruiter_ids=recruiter_ids,
            title="Application withdrawn",
            body=f"A candidate withdrew from {job.title}.",
            resource_type="application",
            resource_id=app.id,
        )
        hiring_team = db.scalars(
            select(User).where(
                User.organization_id == job.organization_id,
                User.role == UserRole.EMPLOYER.value,
            )
        ).all()
        for member in hiring_team:
            notify_user(
                db,
                user_id=member.id,
                title="Application withdrawn",
                body=f"A candidate withdrew from {job.title}.",
                resource_type="application",
                resource_id=app.id,
            )
    record_audit(
        db,
        actor_id=student.id,
        action="application.withdraw",
        resource_type="application",
        resource_id=app.id,
    )
    return app


def request_interview_reschedule(
    db: Session,
    interview,
    student: User,
    *,
    starts_at,
    ends_at,
    reason: str | None,
):
    from datetime import UTC, datetime

    from app.models.entities import InterviewRescheduleRequest, RecruiterAssignment
    from app.shared.enums import InterviewStatus

    app = db.get(Application, interview.application_id)
    if not app or app.student_id != student.id:
        raise ValueError("FORBIDDEN")
    if interview.status in (
        InterviewStatus.CANCELLED.value,
        InterviewStatus.FEEDBACK_SUBMITTED.value,
        InterviewStatus.COMPLETED.value,
    ):
        raise ValueError("INVALID_STATE")
    if starts_at >= ends_at:
        raise ValueError("INVALID_TIME_RANGE")
    if starts_at < datetime.now(UTC):
        raise ValueError("PAST_DATE")

    pending = db.scalar(
        select(InterviewRescheduleRequest).where(
            InterviewRescheduleRequest.interview_id == interview.id,
            InterviewRescheduleRequest.status == "PENDING",
        )
    )
    if pending:
        raise ValueError("RESCHEDULE_PENDING")

    req = InterviewRescheduleRequest(
        interview_id=interview.id,
        student_id=student.id,
        requested_starts_at=starts_at,
        requested_ends_at=ends_at,
        reason=reason,
        status="PENDING",
    )
    db.add(req)
    # Keep interview scheduled until recruiter approves new times

    job = db.get(Job, app.job_id)
    if job:
        recruiter_ids = list(
            db.scalars(
                select(RecruiterAssignment.recruiter_id).where(RecruiterAssignment.job_id == job.id)
            ).all()
        )
        for rid in recruiter_ids:
            notify_user(
                db,
                user_id=rid,
                title="Interview reschedule requested",
                body=f"{student.full_name} requested a new time for {interview.round_name}.",
                resource_type="interview",
                resource_id=interview.id,
            )
        employer = db.scalar(
            select(User).where(
                User.organization_id == job.organization_id, User.role == UserRole.EMPLOYER.value
            )
        )
        if employer:
            notify_user(
                db,
                user_id=employer.id,
                title="Interview reschedule requested",
                body=f"Reschedule pending for {interview.round_name}.",
                resource_type="interview",
                resource_id=interview.id,
            )
    record_audit(
        db,
        actor_id=student.id,
        action="interview.reschedule.request",
        resource_type="interview",
        resource_id=interview.id,
    )
    return req


def respond_interview_reschedule(db: Session, req, actor: User, *, approve: bool, comment: str | None):
    from app.models.entities import Interview
    from app.shared.enums import InterviewStatus

    interview = db.get(Interview, req.interview_id)
    if not interview:
        raise ValueError("NOT_FOUND")
    app = db.get(Application, interview.application_id)
    if not app:
        raise ValueError("NOT_FOUND")
    _assert_recruiter_or_employer(db, app, actor)
    if req.status != "PENDING":
        raise ValueError("INVALID_STATE")
    if approve:
        req.status = "APPROVED"
        interview.starts_at = req.requested_starts_at
        interview.ends_at = req.requested_ends_at
        interview.status = InterviewStatus.SCHEDULED.value
    else:
        req.status = "REJECTED"
        interview.status = InterviewStatus.SCHEDULED.value
    req.reviewer_id = actor.id
    req.reviewer_comment = comment
    notify_user(
        db,
        user_id=req.student_id,
        title="Reschedule " + ("approved" if approve else "declined"),
        body=comment or ("Your new interview time is confirmed." if approve else "Please keep the original schedule."),
        resource_type="interview",
        resource_id=interview.id,
    )
    record_audit(
        db,
        actor_id=actor.id,
        action="interview.reschedule." + ("approve" if approve else "reject"),
        resource_type="interview",
        resource_id=interview.id,
    )
    return req


def schedule_interview(
    db: Session,
    app: Application,
    actor: User,
    *,
    round_name: str,
    format: str,
    starts_at,
    ends_at,
    timezone: str,
    meeting_link: str | None,
    instructions: str | None,
    panel_user_ids: list[str] | None,
):
    from app.models.entities import Interview
    from app.shared.enums import InterviewStatus

    _assert_recruiter_or_employer(db, app, actor)
    if starts_at >= ends_at:
        raise ValueError("INVALID_TIME_RANGE")
    job = db.get(Job, app.job_id)
    interview = Interview(
        application_id=app.id,
        round_name=round_name,
        format=format,
        starts_at=starts_at,
        ends_at=ends_at,
        timezone=timezone,
        meeting_link=meeting_link,
        instructions=instructions,
        panel_user_ids=panel_user_ids or [actor.id],
        status=InterviewStatus.SCHEDULED.value,
    )
    db.add(interview)
    db.flush()
    app.status = ApplicationStatus.INTERVIEW_SCHEDULED.value
    app.pipeline_stage = "Interview"
    notify_user(
        db,
        user_id=app.student_id,
        title="Interview scheduled",
        body=f"{round_name} for {job.title if job else 'your application'} on {starts_at.strftime('%Y-%m-%d %H:%M')}.",
        resource_type="interview",
        resource_id=interview.id,
    )
    record_audit(
        db,
        actor_id=actor.id,
        action="interview.schedule",
        resource_type="interview",
        resource_id=interview.id,
        metadata={"application_id": app.id, "student_id": app.student_id},
    )
    return interview


def submit_interview_feedback(
    db: Session,
    interview,
    actor: User,
    *,
    technical_skills: int,
    problem_solving: int,
    communication: int,
    culture_fit: int,
    comments: str,
    recommendation: str,
):
    from app.models.entities import InterviewScorecard
    from app.shared.enums import InterviewStatus

    app = db.get(Application, interview.application_id)
    if not app:
        raise ValueError("NOT_FOUND")
    _assert_recruiter_or_employer(db, app, actor)
    sc = interview.scorecard
    if not sc:
        sc = InterviewScorecard(
            interview_id=interview.id,
            technical_skills=technical_skills,
            problem_solving=problem_solving,
            communication=communication,
            culture_fit=culture_fit,
            comments=comments,
            recommendation=recommendation,
            submitted_by=actor.id,
        )
        db.add(sc)
    else:
        sc.technical_skills = technical_skills
        sc.problem_solving = problem_solving
        sc.communication = communication
        sc.culture_fit = culture_fit
        sc.comments = comments
        sc.recommendation = recommendation
        sc.submitted_by = actor.id

    interview.status = InterviewStatus.FEEDBACK_SUBMITTED.value
    interview.outcome = recommendation
    notify_user(
        db,
        user_id=app.student_id,
        title="Interview feedback recorded",
        body=f"Panel feedback is available for {interview.round_name}.",
        resource_type="interview",
        resource_id=interview.id,
    )
    record_audit(
        db,
        actor_id=actor.id,
        action="interview.feedback",
        resource_type="interview",
        resource_id=interview.id,
        metadata={"recommendation": recommendation},
    )
    return sc
