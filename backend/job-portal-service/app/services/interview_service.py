"""Scheduled human interviews, scorecards, and reschedule requests."""

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.exceptions import ConflictError, NotFoundError, ValidationFailedError
from app.core.ids import new_public_id
from app.core.security import AccessTokenClaims
from app.core.time import utcnow
from app.domain.enums import Actor, ApplicationStatus, InterviewStatus, RescheduleStatus
from app.models.application import Application
from app.models.interview import Interview, InterviewRescheduleRequest, InterviewScorecard
from app.models.job import Job
from app.services.application_service import ApplicationService
from app.services.outbox import write_event
from app.services.recruiter_assignment_service import RecruiterAssignmentService

S = ApplicationStatus


class InterviewService:
    def __init__(self, db: AsyncSession, settings: Settings) -> None:
        self.db = db
        self.settings = settings
        self.applications = ApplicationService(db, settings)
        self.assignments = RecruiterAssignmentService(db)

    async def _get_interview(self, public_id: int) -> Interview:
        interview = (await self.db.execute(select(Interview).where(Interview.public_id == public_id))).scalar_one_or_none()
        if interview is None:
            raise NotFoundError("Interview not found.", code="INTERVIEW_NOT_FOUND")
        return interview

    async def schedule(
        self,
        auth: AccessTokenClaims,
        application: Application,
        job: Job,
        *,
        round_name: str,
        format: str,
        starts_at: datetime,
        ends_at: datetime,
        timezone: str,
        meeting_link: str | None,
        instructions: str | None,
        panel_user_ids: list[int] | None,
    ) -> Interview:
        await self.assignments.assert_can_manage_job(auth, job)
        if ends_at <= starts_at:
            raise ValidationFailedError(details=[{"field": "ends_at", "code": "INVALID_RANGE", "message": "End time must be after start time"}])
        if application.status in {S.REJECTED, S.WITHDRAWN, S.OFFER_DECLINED, S.PLACED}:
            raise ConflictError("This application is closed.", code="APPLICATION_CLOSED")
        interview = Interview(
            public_id=new_public_id(),
            application_id=application.id,
            job_id=job.id,
            employer_org_id=job.employer_org_id,
            student_user_id=application.user_id,
            round_name=round_name,
            format=format or "online",
            starts_at=starts_at,
            ends_at=ends_at,
            timezone=timezone or "Asia/Kolkata",
            meeting_link=meeting_link,
            instructions=instructions,
            panel_user_ids=panel_user_ids or [],
            status=InterviewStatus.SCHEDULED,
            created_by=auth.user_id,
        )
        self.db.add(interview)
        application.hr_interview_at = starts_at
        application.hr_interview_note = f"Interview scheduled: {round_name}"
        if application.status in {S.SHORTLISTED, S.RECRUITER_REVIEW, S.ASSESSMENT_COMPLETED, S.AI_INTERVIEW_COMPLETED}:
            try:
                await self.applications.move(
                    application, S.HR_INTERVIEW, Actor.RECRUITER, actor_user_id=auth.user_id,
                    note=f"Interview scheduled: {round_name}", job=job, locked=False,
                )
            except ConflictError:
                pass
        write_event(
            self.db, event_type="interview.scheduled", aggregate_type="interview", aggregate_id=interview.id,
            payload={
                "interview_id": str(interview.public_id),
                "application_id": str(application.public_id),
                "job_id": str(job.public_id),
                "user_id": str(application.user_id),
                "starts_at": starts_at.strftime("%Y-%m-%dT%H:%M:%SZ"),
            },
        )
        await self.db.commit()
        return interview

    async def list_for_recruiter(self, auth: AccessTokenClaims, *, page: int, per_page: int) -> tuple[list[Interview], int]:
        q = select(Interview).where(Interview.employer_org_id == auth.organization_id).order_by(Interview.starts_at.desc())
        if auth.role == "recruiter":
            job_ids = await self.assignments.list_job_ids_for_recruiter(auth.user_id)
            if not job_ids:
                return [], 0
            q = q.where(Interview.job_id.in_(job_ids))
        rows = list((await self.db.execute(q.offset((page - 1) * per_page).limit(per_page))).scalars())
        # Approximate total for page UI
        total_q = select(Interview.id).where(Interview.employer_org_id == auth.organization_id)
        if auth.role == "recruiter":
            job_ids = await self.assignments.list_job_ids_for_recruiter(auth.user_id)
            total_q = total_q.where(Interview.job_id.in_(job_ids)) if job_ids else total_q.where(Interview.id == None)  # noqa: E711
        total = len(list((await self.db.execute(total_q)).scalars()))
        return rows, total

    async def list_for_student(self, user_id: int) -> list[Interview]:
        return list(
            (await self.db.execute(select(Interview).where(Interview.student_user_id == user_id).order_by(Interview.starts_at.desc()))).scalars()
        )

    async def submit_feedback(
        self,
        auth: AccessTokenClaims,
        interview_public_id: int,
        *,
        technical_skills: int | None,
        problem_solving: int | None,
        communication: int | None,
        culture_fit: int | None,
        comments: str | None,
        recommendation: str | None,
    ) -> InterviewScorecard:
        interview = await self._get_interview(interview_public_id)
        job = (await self.db.execute(select(Job).where(Job.id == interview.job_id))).scalar_one()
        await self.assignments.assert_can_manage_job(auth, job)
        existing = (await self.db.execute(select(InterviewScorecard).where(InterviewScorecard.interview_id == interview.id))).scalar_one_or_none()
        if existing is not None:
            raise ConflictError("A scorecard already exists for this interview.", code="SCORECARD_EXISTS")
        for label, value in (
            ("technical_skills", technical_skills),
            ("problem_solving", problem_solving),
            ("communication", communication),
            ("culture_fit", culture_fit),
        ):
            if value is not None and not (1 <= value <= 5):
                raise ValidationFailedError(details=[{"field": label, "code": "INVALID_RANGE", "message": "Scores must be between 1 and 5"}])
        card = InterviewScorecard(
            interview_id=interview.id,
            technical_skills=technical_skills,
            problem_solving=problem_solving,
            communication=communication,
            culture_fit=culture_fit,
            comments=comments,
            recommendation=recommendation,
            submitted_by=auth.user_id,
        )
        interview.status = InterviewStatus.COMPLETED
        interview.outcome = recommendation
        self.db.add(card)
        write_event(
            self.db, event_type="interview.feedback_submitted", aggregate_type="interview", aggregate_id=interview.id,
            payload={"interview_id": str(interview.public_id), "recommendation": recommendation, "user_id": str(interview.student_user_id)},
        )
        await self.db.commit()
        return card

    async def request_reschedule(
        self, user_id: int, interview_public_id: int, *, starts_at: datetime, ends_at: datetime, reason: str | None
    ) -> InterviewRescheduleRequest:
        interview = await self._get_interview(interview_public_id)
        if interview.student_user_id != user_id:
            raise NotFoundError("Interview not found.", code="INTERVIEW_NOT_FOUND")
        if interview.status != InterviewStatus.SCHEDULED:
            raise ConflictError("Only a scheduled interview can be rescheduled.", code="INVALID_STATE")
        if ends_at <= starts_at:
            raise ValidationFailedError(details=[{"field": "ends_at", "code": "INVALID_RANGE", "message": "End time must be after start time"}])
        pending = (
            await self.db.execute(
                select(InterviewRescheduleRequest).where(
                    InterviewRescheduleRequest.interview_id == interview.id,
                    InterviewRescheduleRequest.status == RescheduleStatus.PENDING,
                )
            )
        ).scalar_one_or_none()
        if pending is not None:
            raise ConflictError("A reschedule request is already pending.", code="RESCHEDULE_PENDING")
        req = InterviewRescheduleRequest(
            public_id=new_public_id(),
            interview_id=interview.id,
            student_user_id=user_id,
            requested_starts_at=starts_at,
            requested_ends_at=ends_at,
            reason=reason,
            status=RescheduleStatus.PENDING,
        )
        self.db.add(req)
        await self.db.commit()
        return req

    async def respond_reschedule(
        self, auth: AccessTokenClaims, request_public_id: int, *, approve: bool, comment: str | None
    ) -> InterviewRescheduleRequest:
        req = (
            await self.db.execute(select(InterviewRescheduleRequest).where(InterviewRescheduleRequest.public_id == request_public_id))
        ).scalar_one_or_none()
        if req is None:
            raise NotFoundError("Reschedule request not found.", code="RESCHEDULE_NOT_FOUND")
        if req.status != RescheduleStatus.PENDING:
            raise ConflictError("This reschedule request was already decided.", code="INVALID_STATE")
        interview = (await self.db.execute(select(Interview).where(Interview.id == req.interview_id))).scalar_one()
        job = (await self.db.execute(select(Job).where(Job.id == interview.job_id))).scalar_one()
        await self.assignments.assert_can_manage_job(auth, job)
        req.status = RescheduleStatus.APPROVED if approve else RescheduleStatus.DENIED
        req.reviewer_user_id = auth.user_id
        req.reviewer_comment = comment
        if approve:
            interview.starts_at = req.requested_starts_at
            interview.ends_at = req.requested_ends_at
        await self.db.commit()
        return req

    async def list_pending_reschedules(self, auth: AccessTokenClaims) -> list[InterviewRescheduleRequest]:
        interviews, _ = await self.list_for_recruiter(auth, page=1, per_page=500)
        if not interviews:
            return []
        ids = [i.id for i in interviews]
        return list(
            (
                await self.db.execute(
                    select(InterviewRescheduleRequest).where(
                        InterviewRescheduleRequest.interview_id.in_(ids),
                        InterviewRescheduleRequest.status == RescheduleStatus.PENDING,
                    )
                )
            ).scalars()
        )
