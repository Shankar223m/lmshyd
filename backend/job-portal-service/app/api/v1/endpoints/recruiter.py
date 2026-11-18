"""Recruiter-scoped JCMS workflows: assigned applications, interviews, reschedule queue."""

from typing import Annotated

from fastapi import APIRouter, Query
from lms_common.envelopes import PageContext, SortOrder
from sqlalchemy import select

from app.api.deps import ApplicationIdParam, DbSession, JobIdParam, RequireEmployer, SettingsDep, WriteRateLimit
from app.api.presenters import company_names, recruiter_application_out
from app.api.responses import AUTHENTICATED, errors
from app.core.ids import parse_public_id
from app.domain.enums import ApplicationStatus
from app.models.application import Application
from app.models.job import Job
from app.models.refs import CandidateProfile, UserRef
from app.schemas.application import RecruiterApplicationOut, RecruiterApplicationPage
from app.schemas.jcms import (
    InterviewOut,
    InterviewPage,
    InterviewResponse,
    RecruiterAssignRequest,
    RecruiterAssignmentOut,
    RecruiterAssignmentsResponse,
    RescheduleOut,
    RescheduleRespondRequest,
    RescheduleResponse,
    ScheduleInterviewRequest,
    ScorecardOut,
    ScorecardRequest,
    ScorecardResponse,
)
from app.services.application_service import ApplicationService
from app.services.interview_service import InterviewService
from app.services.job_service import JobService
from app.services.recruiter_assignment_service import RecruiterAssignmentService

router = APIRouter(tags=["Recruiter (JCMS)"])


def _interview_out(interview, *, application_public_id: int | None = None, job_public_id: int | None = None) -> InterviewOut:
    return InterviewOut(
        interview_id=interview.public_id,
        application_id=application_public_id,
        job_id=job_public_id,
        round_name=interview.round_name,
        format=interview.format,
        starts_at=interview.starts_at,
        ends_at=interview.ends_at,
        timezone=interview.timezone,
        meeting_link=interview.meeting_link,
        instructions=interview.instructions,
        status=interview.status,
        outcome=interview.outcome,
    )


@router.put(
    "/employer/jobs/{job_id}/recruiters",
    response_model=RecruiterAssignmentsResponse,
    summary="Replace recruiter assignments for a job",
    responses=errors(*AUTHENTICATED, 403, 404),
    dependencies=[WriteRateLimit],
)
async def assign_recruiters(job_id: JobIdParam, body: RecruiterAssignRequest, auth: RequireEmployer, db: DbSession, settings: SettingsDep) -> RecruiterAssignmentsResponse:
    job = await JobService(db, settings).get_for_employer(auth, job_id)
    rows = await RecruiterAssignmentService(db).replace(auth, job, body.recruiter_user_ids)
    return RecruiterAssignmentsResponse(
        message="Recruiters updated.",
        assignments=[RecruiterAssignmentOut(recruiter_user_id=r.recruiter_user_id, assigned_by=r.assigned_by, created_at=r.created_at) for r in rows],
    )


@router.get(
    "/employer/jobs/{job_id}/recruiters",
    response_model=RecruiterAssignmentsResponse,
    summary="List recruiters assigned to a job",
    responses=errors(*AUTHENTICATED, 404),
)
async def list_recruiters(job_id: JobIdParam, auth: RequireEmployer, db: DbSession, settings: SettingsDep) -> RecruiterAssignmentsResponse:
    job = await JobService(db, settings).get_for_employer(auth, job_id)
    await RecruiterAssignmentService(db).assert_can_manage_job(auth, job)
    rows = await RecruiterAssignmentService(db).list_for_job(job)
    return RecruiterAssignmentsResponse(
        message="",
        assignments=[RecruiterAssignmentOut(recruiter_user_id=r.recruiter_user_id, assigned_by=r.assigned_by, created_at=r.created_at) for r in rows],
    )


@router.get(
    "/recruiter/applications",
    response_model=RecruiterApplicationPage,
    summary="Applications across jobs assigned to this recruiter",
    responses=errors(*AUTHENTICATED),
)
async def recruiter_applications(
    auth: RequireEmployer,
    db: DbSession,
    settings: SettingsDep,
    status: Annotated[list[ApplicationStatus] | None, Query()] = None,
    page: Annotated[int, Query(ge=1, le=10_000)] = 1,
    per_page: Annotated[int, Query(ge=1, le=100)] = 20,
) -> RecruiterApplicationPage:
    assignments = RecruiterAssignmentService(db)
    job_ids = await assignments.list_job_ids_for_recruiter(auth.user_id)
    if auth.role == "employer_admin" or not job_ids:
        # Employer admins without explicit assignments see org jobs via standard employer list; recruiters need assignments.
        if auth.role == "recruiter" and not job_ids:
            return RecruiterApplicationPage(message="", applications=[], page_context=PageContext.build(page=page, per_page=per_page, total=0, is_exact=True, sort_column="recent", sort_order=SortOrder.DESC))
    jobs = list((await db.execute(select(Job).where(Job.id.in_(job_ids) if job_ids else Job.employer_org_id == auth.organization_id))).scalars()) if (job_ids or auth.role == "employer_admin") else []
    if auth.role == "employer_admin" and not job_ids:
        jobs = list((await db.execute(select(Job).where(Job.employer_org_id == auth.organization_id))).scalars())
    service = ApplicationService(db, settings)
    applications: list[RecruiterApplicationOut] = []
    for job in jobs:
        await assignments.assert_can_manage_job(auth, job)
        rows, _ = await service.list_for_job(job, statuses=[s.value for s in status] if status else None, min_score=None, sort="recent", q=None, page=1, per_page=per_page)
        c_names = await company_names(db, {job.employer_org_id})
        user_ids = [a.user_id for a, _ in rows]
        profiles = {p.user_id: p for p in (await db.execute(select(CandidateProfile).where(CandidateProfile.user_id.in_(user_ids)))).scalars()} if user_ids else {}
        users = {u.user_id: u for u in (await db.execute(select(UserRef).where(UserRef.user_id.in_(user_ids)))).scalars()} if user_ids else {}
        for application, _match in rows:
            applications.append(
                recruiter_application_out(
                    application, users.get(application.user_id), job, company_name=c_names.get(job.employer_org_id),
                    profile_facts=(profiles.get(application.user_id).facts if profiles.get(application.user_id) else None),
                )
            )
    start = (page - 1) * per_page
    page_rows = applications[start : start + per_page]
    return RecruiterApplicationPage(
        message="",
        applications=page_rows,
        page_context=PageContext.build(page=page, per_page=per_page, total=len(applications), is_exact=True, sort_column="recent", sort_order=SortOrder.DESC),
    )


@router.post(
    "/employer/applications/{application_id}/interviews",
    response_model=InterviewResponse,
    status_code=201,
    summary="Schedule a human interview round",
    responses=errors(*AUTHENTICATED, 404, 409, 422),
    dependencies=[WriteRateLimit],
)
async def schedule_interview(application_id: ApplicationIdParam, body: ScheduleInterviewRequest, auth: RequireEmployer, db: DbSession, settings: SettingsDep) -> InterviewResponse:
    service = ApplicationService(db, settings)
    application, job = await service.get_for_employer(auth, application_id)
    interview = await InterviewService(db, settings).schedule(
        auth, application, job,
        round_name=body.round_name, format=body.format, starts_at=body.starts_at, ends_at=body.ends_at,
        timezone=body.timezone, meeting_link=body.meeting_link, instructions=body.instructions, panel_user_ids=body.panel_user_ids,
    )
    return InterviewResponse(message="Interview scheduled.", interview=_interview_out(interview, application_public_id=application.public_id, job_public_id=job.public_id))


@router.get("/recruiter/interviews", response_model=InterviewPage, summary="Interviews for assigned jobs", responses=errors(*AUTHENTICATED))
async def recruiter_interviews(
    auth: RequireEmployer, db: DbSession, settings: SettingsDep,
    page: Annotated[int, Query(ge=1)] = 1, per_page: Annotated[int, Query(ge=1, le=100)] = 20,
) -> InterviewPage:
    rows, total = await InterviewService(db, settings).list_for_recruiter(auth, page=page, per_page=per_page)
    return InterviewPage(
        message="",
        interviews=[_interview_out(i) for i in rows],
        page_context=PageContext.build(page=page, per_page=per_page, total=total, is_exact=True, sort_column="starts_at", sort_order=SortOrder.DESC),
    )


@router.post(
    "/interviews/{interview_id}/feedback",
    response_model=ScorecardResponse,
    status_code=201,
    summary="Submit interview scorecard",
    responses=errors(*AUTHENTICATED, 404, 409, 422),
    dependencies=[WriteRateLimit],
)
async def interview_feedback(interview_id: str, body: ScorecardRequest, auth: RequireEmployer, db: DbSession, settings: SettingsDep) -> ScorecardResponse:
    from app.core.exceptions import NotFoundError

    pid = parse_public_id(interview_id)
    if pid is None:
        raise NotFoundError("Interview not found.", code="INTERVIEW_NOT_FOUND")
    card = await InterviewService(db, settings).submit_feedback(
        auth, pid,
        technical_skills=body.technical_skills, problem_solving=body.problem_solving,
        communication=body.communication, culture_fit=body.culture_fit,
        comments=body.comments, recommendation=body.recommendation,
    )
    return ScorecardResponse(
        message="Scorecard saved.",
        scorecard=ScorecardOut(
            technical_skills=card.technical_skills, problem_solving=card.problem_solving,
            communication=card.communication, culture_fit=card.culture_fit,
            comments=card.comments, recommendation=card.recommendation,
        ),
    )


@router.get("/recruiter/reschedule-requests", response_model=list[RescheduleOut], summary="Pending interview reschedule requests", responses=errors(*AUTHENTICATED))
async def list_reschedules(auth: RequireEmployer, db: DbSession, settings: SettingsDep) -> list[RescheduleOut]:
    from app.models.interview import Interview

    rows = await InterviewService(db, settings).list_pending_reschedules(auth)
    interview_map = {
        i.id: i for i in (await db.execute(select(Interview).where(Interview.id.in_([r.interview_id for r in rows])))).scalars()
    } if rows else {}
    return [
        RescheduleOut(
            request_id=r.public_id,
            interview_id=interview_map[r.interview_id].public_id if r.interview_id in interview_map else None,
            status=r.status,
            requested_starts_at=r.requested_starts_at,
            requested_ends_at=r.requested_ends_at,
            reason=r.reason,
        )
        for r in rows
    ]


@router.post(
    "/interviews/reschedule-requests/{request_id}/respond",
    response_model=RescheduleResponse,
    summary="Approve or deny a reschedule request",
    responses=errors(*AUTHENTICATED, 404, 409),
    dependencies=[WriteRateLimit],
)
async def respond_reschedule(request_id: str, body: RescheduleRespondRequest, auth: RequireEmployer, db: DbSession, settings: SettingsDep) -> RescheduleResponse:
    from app.core.exceptions import NotFoundError

    pid = parse_public_id(request_id)
    if pid is None:
        raise NotFoundError("Reschedule request not found.", code="RESCHEDULE_NOT_FOUND")
    req = await InterviewService(db, settings).respond_reschedule(auth, pid, approve=body.approve, comment=body.comment)
    from app.models.interview import Interview
    interview = (await db.execute(select(Interview).where(Interview.id == req.interview_id))).scalar_one()
    return RescheduleResponse(
        message="Updated.",
        request=RescheduleOut(
            request_id=req.public_id, interview_id=interview.public_id, status=req.status,
            requested_starts_at=req.requested_starts_at, requested_ends_at=req.requested_ends_at, reason=req.reason,
        ),
    )
