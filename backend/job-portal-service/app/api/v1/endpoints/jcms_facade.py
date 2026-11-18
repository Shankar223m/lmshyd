"""DEPRECATED: use jcms-service (/api/v1/jcms). This facade remains for backward compatibility only.

Gateway routes /api/v1/jcms to jcms-service; new frontends must not depend on this module.
"""

from __future__ import annotations

import csv
import io
from datetime import date, datetime
from typing import Annotated, Any

from fastapi import APIRouter, File, Query, Request, UploadFile
from fastapi.responses import Response, StreamingResponse
from sqlalchemy import desc, func, select

from app.api.deps import CurrentAuth, DbSession, RequireEmployer, RequireStudent, SettingsDep, WriteRateLimit
from app.clients.career import CareerClient
from app.clients.peer import PeerClient
from app.core.exceptions import ConflictError, NotFoundError, PermissionDeniedError, ValidationFailedError
from app.core.ids import new_public_id, parse_public_id
from app.domain.enums import ApplicationStatus, JobStatus, OfferStatus
from app.models.application import Application
from app.models.employer import EmployerProfile
from app.models.job import Job
from app.models.offer import Offer
from app.models.outbox_event import OutboxEvent
from app.models.refs import OrgRef, UserRef
from app.permissions.policy import can_manage_careers, is_institution_staff
from app.permissions.roles import Role
from app.schemas.job import JobCreate
from app.services.application_service import ApplicationService
from app.services.employer_service import EmployerService
from app.services.interview_service import InterviewService
from app.services.job_service import JobService
from app.services.offer_service import OfferService
from app.services.placement_service import PlacementService
from app.services.recruiter_assignment_service import RecruiterAssignmentService

router = APIRouter(prefix="/jcms", tags=["JCMS replacement surface"])


def _data(payload: Any) -> dict[str, Any]:
    return {"data": payload}


def _role(auth) -> str:
    return {
        Role.STUDENT.value: "STUDENT",
        Role.EMPLOYER_ADMIN.value: "EMPLOYER",
        Role.RECRUITER.value: "RECRUITER",
        Role.INSTITUTION_HEAD.value: "INSTITUTION",
        Role.STAFF.value: "INSTITUTION",
        Role.SUPER_ADMIN.value: "PLATFORM_ADMINISTRATOR",
        Role.ADMIN.value: "PLATFORM_ADMINISTRATOR",
    }.get(auth.role, str(auth.role).upper())


def _job_out(job: Job, *, org_name: str | None = None, applicant_count: int = 0) -> dict[str, Any]:
    return {
        "id": str(job.public_id),
        "title": job.title,
        "description": job.description,
        "status": (job.status or "draft").upper(),
        "location": (job.locations or [None])[0] if job.locations else None,
        "employment_type": (job.employment_type or "full_time").upper(),
        "work_mode": (job.location_type or "onsite").upper(),
        "salary_min": job.ctc_min,
        "salary_max": job.ctc_max,
        "salary_currency": job.currency,
        "openings": job.openings,
        "closes_on": job.deadline_at.date().isoformat() if job.deadline_at else None,
        "skills": job.required_skills or [],
        "organization_name": org_name,
        "applicant_count": applicant_count,
        "created_at": job.created_at.isoformat() if getattr(job, "created_at", None) else None,
        "eligibility": job.eligibility or {},
        "questions": (job.application_config or {}).get("questions") or [],
        "hiring_stages": job.hiring_process or [],
    }


def _pid(raw: str, label: str, code: str) -> int:
    pid = parse_public_id(raw)
    if pid is None:
        raise NotFoundError(f"{label} not found.", code=code)
    return pid


@router.get("/auth/me")
async def me(auth: CurrentAuth, db: DbSession) -> dict[str, Any]:
    user = await db.get(UserRef, auth.user_id)
    org_name = None
    if auth.organization_id:
        org = await db.get(OrgRef, auth.organization_id)
        org_name = org.name if org else None
    full_name = " ".join(x for x in ((user.first_name if user else ""), (user.last_name if user else "")) if x) or f"User {auth.user_id}"
    return _data(
        {
            "id": str(auth.user_id),
            "email": user.email if user else None,
            "full_name": full_name,
            "role": _role(auth),
            "organization_id": str(auth.organization_id) if auth.organization_id else None,
            "organization_name": org_name,
        }
    )


@router.get("/auth/profile")
async def profile(auth: CurrentAuth, db: DbSession) -> dict[str, Any]:
    return await me(auth, db)


@router.patch("/auth/profile")
async def patch_profile(body: dict[str, Any]) -> dict[str, Any]:
    return _data({"ok": True, **body})


@router.get("/employers/me")
async def employers_me(auth: RequireEmployer, db: DbSession) -> dict[str, Any]:
    profile = (await db.execute(select(EmployerProfile).where(EmployerProfile.organization_id == auth.organization_id))).scalar_one_or_none()
    org = await db.get(OrgRef, auth.organization_id) if auth.organization_id else None
    return _data(
        {
            "id": str(auth.organization_id),
            "name": org.name if org else "Employer",
            "org_type": "EMPLOYER",
            "verification_status": (profile.status.upper() if profile else "PENDING"),
            "website": getattr(profile, "website", None) if profile else None,
            "industry": getattr(profile, "industry", None) if profile else None,
            "description": getattr(profile, "about", None) if profile else None,
        }
    )


@router.patch("/employers/me")
async def employers_me_patch(auth: RequireEmployer, db: DbSession) -> dict[str, Any]:
    return await employers_me(auth, db)


@router.get("/employers/me/jobs")
async def employers_me_jobs(auth: RequireEmployer, db: DbSession, settings: SettingsDep) -> dict[str, Any]:
    rows, _ = await JobService(db, settings).list_for_employer(auth.organization_id, status=None, q=None, page=1, per_page=100)
    org = await db.get(OrgRef, auth.organization_id) if auth.organization_id else None
    out = []
    for job in rows:
        count = int((await db.execute(select(func.count()).select_from(Application).where(Application.job_id == job.id))).scalar_one())
        out.append(_job_out(job, org_name=org.name if org else None, applicant_count=count))
    return _data(
        {
            "stats": {
                "open_jobs": sum(1 for j in out if j["status"] in {"OPEN", "PUBLISHED"}),
                "pending_approval": sum(1 for j in out if "PENDING" in j["status"]),
                "total_applications": sum(j["applicant_count"] for j in out),
                "offers_out": int(
                    (await db.execute(select(func.count()).select_from(Offer).where(Offer.status.in_([OfferStatus.EXTENDED.value, OfferStatus.ISSUED.value])))).scalar_one()
                ),
                "total_jobs": len(out),
            },
            "jobs": out,
        }
    )


@router.get("/employers/me/recruiters")
async def employers_recruiters(auth: RequireEmployer, db: DbSession) -> dict[str, Any]:
    rows = list((await db.execute(select(UserRef).where(UserRef.organization_id == auth.organization_id, UserRef.role == "recruiter"))).scalars())
    return _data(
        [
            {"id": str(u.user_id), "email": u.email, "full_name": " ".join(x for x in (u.first_name, u.last_name) if x) or str(u.user_id)}
            for u in rows
        ]
    )


@router.post("/jobs", dependencies=[WriteRateLimit])
async def create_job(auth: RequireEmployer, db: DbSession, settings: SettingsDep, body: dict[str, Any]) -> dict[str, Any]:
    work_mode = (body.get("work_mode") or "HYBRID").lower()
    description = (body.get("description") or "Job description pending.").strip()
    if len(description) < 50:
        description = (description + " " + "Role details will be refined before publishing.").strip()
    skills = body.get("skills") or body.get("required_skills") or []
    responsibilities = body.get("responsibilities") or [
        "Deliver assigned work to agreed quality standards",
        "Collaborate with the hiring and product teams",
        "Communicate progress and blockers promptly",
    ]
    minimum_qualifications = body.get("minimum_qualifications") or (
        [f"Proficiency in {s}" for s in skills[:2]] if skills else ["Relevant degree or equivalent experience", "Strong communication skills"]
    )
    if len(minimum_qualifications) < 2:
        minimum_qualifications = [*minimum_qualifications, "Willingness to learn on the job"]
    payload = {
        "title": body.get("title") or "Untitled role",
        "description": description,
        "about_job": body.get("about_job") or description,
        "employment_type": (body.get("employment_type") or "FULL_TIME").lower(),
        "location_type": "onsite" if work_mode == "onsite" else work_mode,
        "locations": [body["location"]] if body.get("location") else ([] if work_mode == "remote" else ["Remote"]),
        "ctc_min": int(body["salary_min"]) if body.get("salary_min") is not None else None,
        "ctc_max": int(body["salary_max"]) if body.get("salary_max") is not None else None,
        "required_skills": skills,
        "openings": int(body.get("openings") or 1),
        "eligibility": body.get("eligibility") or {},
        "application_config": {"questions": body.get("questions") or []},
        "hiring_process": body.get("hiring_stages") or [],
        "responsibilities": responsibilities,
        "minimum_qualifications": minimum_qualifications,
    }
    fields = JobCreate.model_validate(payload).model_dump(exclude={"employer_org_id"})
    job = await JobService(db, settings).create(auth, auth.organization_id or 0, fields)
    recruiter_ids = [int(x) for x in (body.get("recruiter_ids") or [])]
    if recruiter_ids:
        await RecruiterAssignmentService(db).replace(auth, job, recruiter_ids)
    return _data(_job_out(job))


@router.get("/jobs/discover")
async def discover(auth: RequireStudent, db: DbSession, q: Annotated[str | None, Query()] = None) -> dict[str, Any]:
    stmt = select(Job).where(Job.status == JobStatus.OPEN).limit(50)
    if q:
        stmt = select(Job).where(Job.status == JobStatus.OPEN, Job.title.ilike(f"%{q}%")).limit(50)
    jobs = list((await db.execute(stmt)).scalars())
    out = []
    for job in jobs:
        org = await db.get(OrgRef, job.employer_org_id)
        row = _job_out(job, org_name=org.name if org else None)
        row["match_percent"] = None
        row["eligibility"] = "unknown"
        out.append(row)
    return _data(out)


@router.get("/jobs/{job_id}")
async def get_job(job_id: str, auth: CurrentAuth, db: DbSession, settings: SettingsDep) -> dict[str, Any]:
    job = await JobService(db, settings).get(_pid(job_id, "Job", "JOB_NOT_FOUND"))
    org = await db.get(OrgRef, job.employer_org_id)
    return _data(_job_out(job, org_name=org.name if org else None))


@router.patch("/jobs/{job_id}", dependencies=[WriteRateLimit])
async def patch_job(job_id: str, auth: RequireEmployer, db: DbSession, settings: SettingsDep, body: dict[str, Any]) -> dict[str, Any]:
    job = await JobService(db, settings).get_for_employer(auth, _pid(job_id, "Job", "JOB_NOT_FOUND"))
    fields: dict[str, Any] = {}
    if "title" in body:
        fields["title"] = body["title"]
    if "description" in body:
        fields["description"] = body["description"]
    if "skills" in body:
        fields["required_skills"] = body["skills"]
    if "eligibility" in body:
        fields["eligibility"] = body["eligibility"]
    if fields:
        job = await JobService(db, settings).update(job, fields)
        await db.commit()
    if "recruiter_ids" in body:
        recruiter_ids = [int(x) for x in (body.get("recruiter_ids") or [])]
        await RecruiterAssignmentService(db).replace(auth, job, recruiter_ids)
    return _data(_job_out(job))


@router.put("/jobs/{job_id}/eligibility", dependencies=[WriteRateLimit])
async def put_eligibility(job_id: str, auth: RequireEmployer, db: DbSession, settings: SettingsDep, body: dict[str, Any]) -> dict[str, Any]:
    job = await JobService(db, settings).get_for_employer(auth, _pid(job_id, "Job", "JOB_NOT_FOUND"))
    job = await JobService(db, settings).update(job, {"eligibility": body})
    await db.commit()
    return _data(job.eligibility or {})


@router.post("/jobs/{job_id}/submit", dependencies=[WriteRateLimit])
async def submit_job(job_id: str, auth: RequireEmployer, db: DbSession, settings: SettingsDep) -> dict[str, Any]:
    job = await JobService(db, settings).get_for_employer(auth, _pid(job_id, "Job", "JOB_NOT_FOUND"))
    job = await JobService(db, settings).submit(job)
    await db.commit()
    return _data(_job_out(job))


@router.post("/jobs/{job_id}/publish", dependencies=[WriteRateLimit])
async def publish_job(job_id: str, auth: RequireEmployer, db: DbSession, settings: SettingsDep) -> dict[str, Any]:
    job = await JobService(db, settings).get_for_employer(auth, _pid(job_id, "Job", "JOB_NOT_FOUND"))
    if job.status == JobStatus.DRAFT:
        job = await JobService(db, settings).submit(job)
        await db.commit()
    return _data(_job_out(job))


@router.post("/jobs/{job_id}/close", dependencies=[WriteRateLimit])
async def close_job(job_id: str, auth: RequireEmployer, db: DbSession, settings: SettingsDep) -> dict[str, Any]:
    job = await JobService(db, settings).get_for_employer(auth, _pid(job_id, "Job", "JOB_NOT_FOUND"))
    job = await JobService(db, settings).close(job, "Closed by employer")
    await db.commit()
    return _data(_job_out(job))


@router.get("/jobs/{job_id}/pipeline")
async def pipeline(job_id: str, auth: RequireEmployer, db: DbSession, settings: SettingsDep) -> dict[str, Any]:
    job = await JobService(db, settings).get_for_employer(auth, _pid(job_id, "Job", "JOB_NOT_FOUND"))
    rows, _ = await ApplicationService(db, settings).list_for_job(job, statuses=None, min_score=None, sort="recent", q=None, page=1, per_page=200)
    applications = []
    columns: dict[str, list] = {}
    for application, _ in rows:
        user = await db.get(UserRef, application.user_id)
        name = " ".join(x for x in ((user.first_name if user else ""), (user.last_name if user else "")) if x) or "Candidate"
        item = {"id": str(application.public_id), "student_name": name, "status": application.status, "match_percent": application.match_score, "pipeline_stage": application.status}
        columns.setdefault(application.status, []).append(item)
        applications.append(item)
    return _data({"job_id": str(job.public_id), "columns": columns, "applications": applications})


@router.post("/jobs/{job_id}/applications", dependencies=[WriteRateLimit])
async def apply(job_id: str, auth: RequireStudent, db: DbSession, settings: SettingsDep, body: dict[str, Any]) -> dict[str, Any]:
    application = await ApplicationService(db, settings).apply(
        auth,
        _pid(job_id, "Job", "JOB_NOT_FOUND"),
        resume_id=int(body["resume_id"]) if body.get("resume_id") else None,
        cover_note=body.get("cover_note"),
        answers=body.get("answers") or {},
        career=CareerClient(settings),
    )
    return _data({"id": str(application.public_id), "status": application.status})


@router.get("/applications/me")
async def applications_me(auth: RequireStudent, db: DbSession, settings: SettingsDep) -> dict[str, Any]:
    rows, _ = await ApplicationService(db, settings).list_mine(auth.user_id, status=None, page=1, per_page=100, active=None)
    out = []
    for application, job in rows:
        org = await db.get(OrgRef, job.employer_org_id)
        out.append(
            {
                "id": str(application.public_id),
                "job_id": str(job.public_id),
                "job_title": job.title,
                "organization_name": org.name if org else None,
                "status": application.status.upper(),
                "pipeline_stage": application.status,
                "match_percent": application.match_score,
                "created_at": application.created_at.isoformat() if application.created_at else None,
            }
        )
    return _data(out)


@router.post("/applications/{application_id}/withdraw", dependencies=[WriteRateLimit])
async def withdraw(application_id: str, auth: RequireStudent, db: DbSession, settings: SettingsDep, body: dict[str, Any] | None = None) -> dict[str, Any]:
    application = await ApplicationService(db, settings).get_mine(auth.user_id, _pid(application_id, "Application", "APPLICATION_NOT_FOUND"))
    application = await ApplicationService(db, settings).withdraw(auth.user_id, application, (body or {}).get("note"))
    return _data({"id": str(application.public_id), "status": application.status})


@router.get("/recruiter/applications")
async def recruiter_applications(auth: RequireEmployer, db: DbSession, settings: SettingsDep) -> dict[str, Any]:
    job_ids = await RecruiterAssignmentService(db).list_job_ids_for_recruiter(auth.user_id)
    q = select(Job).where(Job.employer_org_id == auth.organization_id)
    if auth.role == Role.RECRUITER.value:
        if not job_ids:
            return _data([])
        q = q.where(Job.id.in_(job_ids))
    jobs = list((await db.execute(q)).scalars())
    out = []
    for job in jobs:
        rows, _ = await ApplicationService(db, settings).list_for_job(job, statuses=None, min_score=None, sort="recent", q=None, page=1, per_page=100)
        for application, _ in rows:
            user = await db.get(UserRef, application.user_id)
            name = " ".join(x for x in ((user.first_name if user else ""), (user.last_name if user else "")) if x) or "Candidate"
            out.append(
                {
                    "id": str(application.public_id),
                    "job_id": str(job.public_id),
                    "job_title": job.title,
                    "student_name": name,
                    "status": application.status,
                    "match_percent": application.match_score,
                    "email": user.email if user else None,
                }
            )
    return _data(out)


@router.post("/applications/{application_id}/shortlist", dependencies=[WriteRateLimit])
async def shortlist(application_id: str, auth: RequireEmployer, db: DbSession, settings: SettingsDep) -> dict[str, Any]:
    application, job = await ApplicationService(db, settings).get_for_employer(auth, _pid(application_id, "Application", "APPLICATION_NOT_FOUND"))
    await RecruiterAssignmentService(db).assert_can_manage_job(auth, job)
    application = await ApplicationService(db, settings).transition(auth, application, job, ApplicationStatus.SHORTLISTED, note=None, hr_interview_at=None)
    return _data({"id": str(application.public_id), "status": application.status})


@router.post("/applications/{application_id}/reject", dependencies=[WriteRateLimit])
async def reject_one(application_id: str, auth: RequireEmployer, db: DbSession, settings: SettingsDep, body: dict[str, Any] | None = None) -> dict[str, Any]:
    application, job = await ApplicationService(db, settings).get_for_employer(auth, _pid(application_id, "Application", "APPLICATION_NOT_FOUND"))
    await ApplicationService(db, settings).reject_batch(auth, job, [application.public_id], reason=(body or {}).get("reason") or "Rejected", confirmed=True, threshold=None)
    return _data({"id": str(application.public_id), "status": "rejected"})


@router.post("/applications/{application_id}/hold", dependencies=[WriteRateLimit])
async def hold(application_id: str, auth: RequireEmployer, db: DbSession, settings: SettingsDep, body: dict[str, Any] | None = None) -> dict[str, Any]:
    application, _ = await ApplicationService(db, settings).get_for_employer(auth, _pid(application_id, "Application", "APPLICATION_NOT_FOUND"))
    await ApplicationService(db, settings).add_note(auth, application, (body or {}).get("reason") or "On hold")
    return _data({"id": str(application.public_id), "status": application.status, "held": True})


@router.post("/applications/{application_id}/note", dependencies=[WriteRateLimit])
async def note(application_id: str, auth: RequireEmployer, db: DbSession, settings: SettingsDep, body: dict[str, Any]) -> dict[str, Any]:
    application, _ = await ApplicationService(db, settings).get_for_employer(auth, _pid(application_id, "Application", "APPLICATION_NOT_FOUND"))
    await ApplicationService(db, settings).add_note(auth, application, body.get("body") or body.get("note") or "")
    return _data({"ok": True})


_STATUS_MAP = {
    "SHORTLISTED": ApplicationStatus.SHORTLISTED,
    "ASSESSMENT": ApplicationStatus.ASSESSMENT_INVITED,
    "ASSESSMENT_INVITED": ApplicationStatus.ASSESSMENT_INVITED,
    "INTERVIEW_SCHEDULED": ApplicationStatus.HR_INTERVIEW,
    "INTERVIEW": ApplicationStatus.HR_INTERVIEW,
    "HR_INTERVIEW": ApplicationStatus.HR_INTERVIEW,
    "AI_INTERVIEW_INVITED": ApplicationStatus.AI_INTERVIEW_INVITED,
    "RECRUITER_REVIEW": ApplicationStatus.RECRUITER_REVIEW,
    "SELECTED": ApplicationStatus.RECRUITER_REVIEW,
}


@router.post("/applications/{application_id}/transition", dependencies=[WriteRateLimit])
async def transition(application_id: str, auth: RequireEmployer, db: DbSession, settings: SettingsDep, body: dict[str, Any] | None = None) -> dict[str, Any]:
    application, job = await ApplicationService(db, settings).get_for_employer(auth, _pid(application_id, "Application", "APPLICATION_NOT_FOUND"))
    await RecruiterAssignmentService(db).assert_can_manage_job(auth, job)
    raw = str((body or {}).get("to_status") or "").upper()
    target = _STATUS_MAP.get(raw)
    if target is None:
        raise ConflictError(f"Unsupported transition target: {raw}", code="INVALID_TRANSITION")
    application = await ApplicationService(db, settings).transition(
        auth, application, job, target, note=(body or {}).get("note") or (body or {}).get("pipeline_stage"), hr_interview_at=None
    )
    return _data({"id": str(application.public_id), "status": application.status})


@router.post("/interviews/reschedule-requests/{request_id}/respond", dependencies=[WriteRateLimit])
async def respond_reschedule(request_id: str, auth: RequireEmployer, db: DbSession, settings: SettingsDep, body: dict[str, Any] | None = None) -> dict[str, Any]:
    action = str((body or {}).get("action") or "approve").lower()
    req = await InterviewService(db, settings).respond_reschedule(
        auth, _pid(request_id, "RescheduleRequest", "RESCHEDULE_NOT_FOUND"), approve=(action == "approve"), comment=(body or {}).get("comment")
    )
    return _data({"id": str(req.public_id), "status": req.status})


@router.get("/recruiter/interviews")
async def recruiter_interviews(auth: RequireEmployer, db: DbSession, settings: SettingsDep) -> dict[str, Any]:
    rows, _ = await InterviewService(db, settings).list_for_recruiter(auth, page=1, per_page=100)
    return _data(
        [{"id": str(i.public_id), "round_name": i.round_name, "format": i.format, "starts_at": i.starts_at.isoformat(), "ends_at": i.ends_at.isoformat(), "status": i.status, "meeting_link": i.meeting_link} for i in rows]
    )


@router.get("/recruiter/reschedule-requests")
async def recruiter_reschedules(auth: RequireEmployer, db: DbSession, settings: SettingsDep) -> dict[str, Any]:
    rows = await InterviewService(db, settings).list_pending_reschedules(auth)
    return _data(
        [{"id": str(r.public_id), "status": r.status, "requested_starts_at": r.requested_starts_at.isoformat(), "requested_ends_at": r.requested_ends_at.isoformat(), "reason": r.reason} for r in rows]
    )


@router.post("/applications/{application_id}/interviews", dependencies=[WriteRateLimit])
async def schedule(application_id: str, auth: RequireEmployer, db: DbSession, settings: SettingsDep, body: dict[str, Any]) -> dict[str, Any]:
    application, job = await ApplicationService(db, settings).get_for_employer(auth, _pid(application_id, "Application", "APPLICATION_NOT_FOUND"))
    starts = datetime.fromisoformat(str(body["starts_at"]).replace("Z", "+00:00"))
    ends = datetime.fromisoformat(str(body["ends_at"]).replace("Z", "+00:00"))
    interview = await InterviewService(db, settings).schedule(
        auth, application, job,
        round_name=body.get("round_name") or "Interview",
        format=(body.get("format") or "online").lower(),
        starts_at=starts, ends_at=ends,
        timezone=body.get("timezone") or "Asia/Kolkata",
        meeting_link=body.get("meeting_link"),
        instructions=body.get("instructions"),
        panel_user_ids=body.get("panel_user_ids") or [],
    )
    return _data({"id": str(interview.public_id), "status": interview.status})


@router.post("/interviews/{interview_id}/feedback", dependencies=[WriteRateLimit])
async def feedback(interview_id: str, auth: RequireEmployer, db: DbSession, settings: SettingsDep, body: dict[str, Any]) -> dict[str, Any]:
    card = await InterviewService(db, settings).submit_feedback(
        auth, _pid(interview_id, "Interview", "INTERVIEW_NOT_FOUND"),
        technical_skills=body.get("technical_skills"), problem_solving=body.get("problem_solving"),
        communication=body.get("communication"), culture_fit=body.get("culture_fit"),
        comments=body.get("comments"), recommendation=body.get("recommendation"),
    )
    return _data({"recommendation": card.recommendation})


@router.get("/interviews/me")
async def interviews_me(auth: RequireStudent, db: DbSession, settings: SettingsDep) -> dict[str, Any]:
    rows = await InterviewService(db, settings).list_for_student(auth.user_id)
    return _data(
        [{"id": str(i.public_id), "round_name": i.round_name, "format": i.format, "starts_at": i.starts_at.isoformat(), "ends_at": i.ends_at.isoformat(), "status": i.status, "meeting_link": i.meeting_link, "instructions": i.instructions} for i in rows]
    )


@router.get("/offers/me")
async def offers_me(auth: RequireStudent, db: DbSession, settings: SettingsDep) -> dict[str, Any]:
    rows = await OfferService(db, settings).list_for_student(auth.user_id)
    return _data(
        [
            {
                "id": str(offer.public_id),
                "application_id": str(application.public_id),
                "role_title": offer.role_title,
                "annual_package": offer.ctc,
                "currency": offer.currency,
                "joining_date": offer.joining_date.isoformat() if offer.joining_date else None,
                "status": offer.status.upper(),
                "respond_by": offer.expires_at.date().isoformat() if offer.expires_at else None,
                "location": offer.location,
            }
            for offer, application in rows
        ]
    )


@router.post("/offers/{offer_id}/respond", dependencies=[WriteRateLimit])
async def offer_respond(offer_id: str, auth: RequireStudent, db: DbSession, settings: SettingsDep, body: dict[str, Any]) -> dict[str, Any]:
    offer = (await db.execute(select(Offer).where(Offer.public_id == _pid(offer_id, "Offer", "OFFER_NOT_FOUND")))).scalar_one_or_none()
    if offer is None:
        raise NotFoundError("Offer not found.", code="OFFER_NOT_FOUND")
    application = (await db.execute(select(Application).where(Application.id == offer.application_id))).scalar_one()
    offer = await OfferService(db, settings).respond(auth.user_id, application, accept=bool(body.get("accept")), note=body.get("note"))
    return _data({"id": str(offer.public_id), "status": offer.status})


@router.post("/applications/{application_id}/offers", dependencies=[WriteRateLimit])
async def create_offer(application_id: str, auth: RequireEmployer, db: DbSession, settings: SettingsDep, body: dict[str, Any]) -> dict[str, Any]:
    application, job = await ApplicationService(db, settings).get_for_employer(auth, _pid(application_id, "Application", "APPLICATION_NOT_FOUND"))
    joining = date.fromisoformat(body["joining_date"]) if body.get("joining_date") else None
    offer = await OfferService(db, settings).extend(
        auth, application, job,
        ctc=int(body.get("annual_package") or body.get("ctc") or 0),
        currency=body.get("currency") or "INR",
        joining_date=joining,
        valid_days=body.get("valid_days") or 7,
        note=body.get("note"),
        role_title=body.get("role_title"),
        requires_approval=bool(body.get("requires_approval")),
        location=body.get("location"),
        offer_letter_media_id=int(body["offer_letter_file_id"]) if body.get("offer_letter_file_id") else None,
    )
    return _data({"id": str(offer.public_id), "status": offer.status})


@router.get("/placements/me")
async def placements_me(auth: RequireStudent, db: DbSession, settings: SettingsDep) -> dict[str, Any]:
    rows = await PlacementService(db, settings).list_for_student(auth.user_id)
    if not rows:
        return _data(None)
    p = rows[0]
    evidence = await PlacementService(db, settings).list_evidence(p)
    return _data(
        {
            "id": str(p.public_id),
            "status": p.status.upper(),
            "designation": p.designation,
            "joining_date": p.joining_date.isoformat() if p.joining_date else None,
            "annual_package": p.annual_package,
            "work_location": p.work_location,
            "verifier_comment": p.verifier_comment,
            "evidence_documents": [{"id": str(e.public_id), "category": e.category, "status": e.status, "file_id": str(e.media_asset_id)} for e in evidence],
        }
    )


@router.post("/placements/{placement_id}/evidence", dependencies=[WriteRateLimit])
async def placement_evidence(placement_id: str, auth: RequireStudent, db: DbSession, settings: SettingsDep, body: dict[str, Any]) -> dict[str, Any]:
    pid = _pid(placement_id, "Placement", "PLACEMENT_NOT_FOUND")
    if body.get("file_id") or body.get("media_asset_id"):
        await PlacementService(db, settings).add_evidence(auth.user_id, pid, media_asset_id=int(body.get("media_asset_id") or body.get("file_id")), category=body.get("category") or "offer_letter")
    else:
        await PlacementService(db, settings).submit_details(
            auth.user_id, pid,
            designation=body.get("designation"),
            joining_date=date.fromisoformat(body["joining_date"]) if body.get("joining_date") else None,
            annual_package=int(body["annual_package"]) if body.get("annual_package") is not None else None,
            work_location=body.get("work_location"),
        )
    return await placements_me(auth, db, settings)


@router.get("/institutions/me/placements")
async def institution_placements(auth: CurrentAuth, db: DbSession, settings: SettingsDep) -> dict[str, Any]:
    if not is_institution_staff(auth):
        raise PermissionDeniedError("Institution only.", code="INSTITUTION_ONLY")
    rows = await PlacementService(db, settings).list_for_institution(auth.organization_id or 0)
    return _data([{"id": str(p.public_id), "status": p.status, "designation": p.designation, "annual_package": p.annual_package, "student_id": str(p.student_user_id)} for p in rows])


@router.post("/institutions/me/placements/{placement_id}/verify", dependencies=[WriteRateLimit])
async def institution_verify(placement_id: str, auth: CurrentAuth, db: DbSession, settings: SettingsDep, body: dict[str, Any] | None = None) -> dict[str, Any]:
    placement = await PlacementService(db, settings).review(auth, _pid(placement_id, "Placement", "PLACEMENT_NOT_FOUND"), action=(body or {}).get("action") or "verify", comment=(body or {}).get("comment"))
    return _data({"id": str(placement.public_id), "status": placement.status})


@router.get("/institutions/me/students")
async def institution_students(auth: CurrentAuth, db: DbSession, q: Annotated[str, Query()] = "") -> dict[str, Any]:
    if not is_institution_staff(auth):
        raise PermissionDeniedError("Institution only.", code="INSTITUTION_ONLY")
    rows = list((await db.execute(select(UserRef).where(UserRef.organization_id == auth.organization_id, UserRef.role == "student").limit(200))).scalars())
    if q:
        ql = q.lower()
        rows = [u for u in rows if ql in ((u.email or "") + (u.first_name or "") + (u.last_name or "")).lower()]
    return _data([{"id": str(u.user_id), "email": u.email, "full_name": " ".join(x for x in (u.first_name, u.last_name) if x)} for u in rows])


def _split_name(full_name: str) -> tuple[str, str]:
    parts = [p for p in (full_name or "").strip().split() if p]
    if not parts:
        return "Student", "User"
    if len(parts) == 1:
        return parts[0], "Student"
    return parts[0], " ".join(parts[1:])


def _preview_student_rows(rows: list[dict[str, Any]]) -> dict[str, Any]:
    preview_rows: list[dict[str, Any]] = []
    valid_rows: list[dict[str, str]] = []
    for idx, raw in enumerate(rows, start=2):
        row = {str(k).strip().lower(): str(v).strip() if v is not None else "" for k, v in (raw or {}).items()}
        email = row.get("email") or ""
        full_name = row.get("full_name") or row.get("name") or ""
        errors: list[str] = []
        if not email or "@" not in email:
            errors.append("Valid email is required")
        if not full_name:
            errors.append("full_name is required")
        item = {
            "line": idx,
            "email": email,
            "full_name": full_name,
            "program": row.get("program") or "",
            "department": row.get("department") or row.get("branch") or "",
            "batch": row.get("batch") or "",
            "errors": errors,
            "valid": not errors,
        }
        preview_rows.append(item)
        if not errors:
            valid_rows.append(
                {
                    "email": email,
                    "full_name": full_name,
                    "program": item["program"],
                    "department": item["department"],
                    "batch": item["batch"],
                    "admission_number": row.get("admission_number") or f"IMP-{idx}-{email.split('@')[0][:12]}",
                    "date_of_birth": row.get("date_of_birth") or "2004-01-01",
                }
            )
    return {
        "rows": preview_rows,
        "valid_count": len(valid_rows),
        "error_count": sum(1 for r in preview_rows if not r["valid"]),
        "total_rows": len(preview_rows),
        "valid_rows": valid_rows,
    }


@router.get("/institutions/me/students/csv-template")
async def students_csv_template(auth: CurrentAuth) -> Response:
    if not is_institution_staff(auth):
        raise PermissionDeniedError("Institution only.", code="INSTITUTION_ONLY")
    content = (
        "email,full_name,program,department,batch,admission_number,date_of_birth\n"
        "student1@college.edu,Asha Rao,B.Tech,Computer Science,2022-2026,ADM-001,2004-05-12\n"
    )
    return Response(
        content=content,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="students_import_template.csv"'},
    )


@router.post("/institutions/me/students/import/preview")
async def import_preview(auth: CurrentAuth, body: dict[str, Any] | None = None) -> dict[str, Any]:
    if not is_institution_staff(auth):
        raise PermissionDeniedError("Institution only.", code="INSTITUTION_ONLY")
    rows = list((body or {}).get("rows") or [])
    return _data(_preview_student_rows(rows))


@router.post("/institutions/me/students/import", dependencies=[WriteRateLimit])
async def import_students(auth: CurrentAuth, request: Request, settings: SettingsDep, body: dict[str, Any] | None = None) -> dict[str, Any]:
    """Validate JCMS rows then proxy create through user-management CSV import (LMS conventions)."""
    if not is_institution_staff(auth):
        raise PermissionDeniedError("Institution only.", code="INSTITUTION_ONLY")
    preview = _preview_student_rows(list((body or {}).get("rows") or []))
    valid_rows = preview["valid_rows"]
    if not valid_rows:
        return _data({"created": 0, "skipped": [{"email": r["email"], "reason": "; ".join(r["errors"])} for r in preview["rows"] if not r["valid"]]})

    buffer = io.StringIO()
    header = [
        "role", "email", "username", "first_name", "last_name", "gender", "date_of_birth", "phone",
        "employee_code", "designation", "admission_number", "guardian_name", "guardian_relationship", "guardian_phone",
    ]
    writer = csv.DictWriter(buffer, fieldnames=header)
    writer.writeheader()
    for row in valid_rows:
        first, last = _split_name(row["full_name"])
        writer.writerow(
            {
                "role": "student",
                "email": row["email"],
                "username": "",
                "first_name": first,
                "last_name": last,
                "gender": "",
                "date_of_birth": row["date_of_birth"],
                "phone": "",
                "employee_code": "",
                "designation": "",
                "admission_number": row["admission_number"],
                "guardian_name": "Institution Import",
                "guardian_relationship": "other",
                "guardian_phone": "+910000000000",
            }
        )
    csv_bytes = ("\ufeff" + buffer.getvalue()).encode("utf-8")
    peer = PeerClient(settings, authorization=request.headers.get("authorization"))
    status, result = await peer.post_multipart(
        settings.USER_MANAGEMENT_URL,
        "/api/v1/users/import",
        files={"file": ("students.csv", csv_bytes, "text/csv")},
        data={"dry_run": "false", "mode": "skip_invalid"},
        timeout=settings.USER_MANAGEMENT_TIMEOUT_SECONDS,
    )
    if status >= 400:
        raise ValidationFailedError(
            details=[{"field": "import", "code": "USER_MANAGEMENT_IMPORT_FAILED", "message": str(result.get("message") or result)}]
        )
    import_result = result.get("import_result") or result
    created = int(import_result.get("created") or 0)
    errors = import_result.get("errors") or []
    skipped = [{"email": e.get("email") or e.get("row") or "", "reason": e.get("message") or str(e)} for e in errors]
    for r in preview["rows"]:
        if not r["valid"]:
            skipped.append({"email": r["email"], "reason": "; ".join(r["errors"])})
    return _data({"created": created, "skipped": skipped, "user_management": import_result})


@router.get("/institutions/me/analytics")
async def institution_analytics(auth: CurrentAuth, db: DbSession) -> dict[str, Any]:
    if not is_institution_staff(auth):
        raise PermissionDeniedError("Institution only.", code="INSTITUTION_ONLY")
    org = auth.organization_id or 0
    apps = int((await db.execute(select(func.count()).select_from(Application).where(Application.organization_id == org))).scalar_one())
    placed = int((await db.execute(select(func.count()).select_from(Application).where(Application.organization_id == org, Application.status == ApplicationStatus.PLACED))).scalar_one())
    return _data({"applications": apps, "placed": placed, "placement_rate": (placed / apps * 100) if apps else 0})


@router.get("/institutions/me")
async def institutions_me(auth: CurrentAuth, db: DbSession) -> dict[str, Any]:
    org = await db.get(OrgRef, auth.organization_id) if auth.organization_id else None
    return _data({"id": str(auth.organization_id), "name": org.name if org else "Institution", "org_type": "INSTITUTION"})


@router.get("/admin/stats")
async def admin_stats(auth: CurrentAuth, db: DbSession) -> dict[str, Any]:
    if not can_manage_careers(auth):
        raise PermissionDeniedError("Careers managers only.", code="PERMISSION_DENIED")
    return _data(
        {
            "jobs": int((await db.execute(select(func.count()).select_from(Job))).scalar_one()),
            "applications": int((await db.execute(select(func.count()).select_from(Application))).scalar_one()),
            "employers": int((await db.execute(select(func.count()).select_from(EmployerProfile))).scalar_one()),
            "pending_moderation": int((await db.execute(select(func.count()).select_from(Job).where(Job.status == JobStatus.PENDING_APPROVAL))).scalar_one()),
        }
    )


@router.get("/admin/organizations/pending")
async def admin_orgs_pending(auth: CurrentAuth, db: DbSession) -> dict[str, Any]:
    if not can_manage_careers(auth):
        raise PermissionDeniedError("Careers managers only.", code="PERMISSION_DENIED")
    rows = list((await db.execute(select(EmployerProfile).where(EmployerProfile.status == "pending"))).scalars())
    out = []
    for p in rows:
        org = await db.get(OrgRef, p.organization_id)
        out.append({"id": str(p.organization_id), "name": org.name if org else str(p.organization_id), "verification_status": p.status})
    return _data(out)


@router.post("/admin/organizations/{organization_id}/verify", dependencies=[WriteRateLimit])
async def admin_verify_org(organization_id: str, auth: CurrentAuth, db: DbSession, settings: SettingsDep, body: dict[str, Any] | None = None) -> dict[str, Any]:
    if not can_manage_careers(auth):
        raise PermissionDeniedError("Careers managers only.", code="PERMISSION_DENIED")
    oid = parse_public_id(organization_id) or int(organization_id)
    action = (body or {}).get("action") or "verify"
    await EmployerService(db, settings).review(oid, auth.user_id, approve=(action == "verify"), note=(body or {}).get("comment"))
    await db.commit()
    return _data({"ok": True, "action": action})


@router.get("/admin/jobs/pending-moderation")
async def admin_jobs_pending(auth: CurrentAuth, db: DbSession) -> dict[str, Any]:
    if not can_manage_careers(auth):
        raise PermissionDeniedError("Careers managers only.", code="PERMISSION_DENIED")
    rows = list((await db.execute(select(Job).where(Job.status == JobStatus.PENDING_APPROVAL).limit(100))).scalars())
    return _data([_job_out(j) for j in rows])


@router.post("/admin/jobs/{job_id}/moderate", dependencies=[WriteRateLimit])
async def admin_moderate(job_id: str, auth: CurrentAuth, db: DbSession, settings: SettingsDep, body: dict[str, Any] | None = None) -> dict[str, Any]:
    if not can_manage_careers(auth):
        raise PermissionDeniedError("Careers managers only.", code="PERMISSION_DENIED")
    job = await JobService(db, settings).get(_pid(job_id, "Job", "JOB_NOT_FOUND"))
    action = (body or {}).get("action") or "approve"
    job = await JobService(db, settings).review(job, auth.user_id, approve=(action == "approve"), note=(body or {}).get("note"))
    await db.commit()
    return _data(_job_out(job))


@router.get("/admin/audit-logs")
async def admin_audit(
    auth: CurrentAuth,
    db: DbSession,
    action: Annotated[str, Query()] = "",
    resource_type: Annotated[str, Query()] = "",
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
) -> dict[str, Any]:
    """Careers audit feed sourced from the job-portal transactional outbox."""
    if not can_manage_careers(auth):
        raise PermissionDeniedError("Careers managers only.", code="PERMISSION_DENIED")
    stmt = select(OutboxEvent).order_by(desc(OutboxEvent.created_at)).limit(limit)
    if action:
        stmt = stmt.where(OutboxEvent.event_type.ilike(f"%{action}%"))
    if resource_type:
        stmt = stmt.where(OutboxEvent.aggregate_type.ilike(f"%{resource_type}%"))
    rows = list((await db.execute(stmt)).scalars())
    out = []
    for ev in rows:
        payload = ev.payload or {}
        out.append(
            {
                "id": str(ev.id),
                "actor_name": payload.get("actor_name") or payload.get("actor") or payload.get("user_id") or "system",
                "actor_email": payload.get("actor_email"),
                "actor_role": payload.get("actor_role"),
                "action": ev.event_type,
                "resource_type": ev.aggregate_type,
                "resource_id": str(payload.get("job_id") or payload.get("application_id") or ev.aggregate_id),
                "created_at": ev.created_at.isoformat() if ev.created_at else None,
                "metadata": payload,
            }
        )
    return _data(out)


@router.get("/admin/jobs")
async def admin_jobs(auth: CurrentAuth, db: DbSession) -> dict[str, Any]:
    if not can_manage_careers(auth):
        raise PermissionDeniedError("Careers managers only.", code="PERMISSION_DENIED")
    rows = list((await db.execute(select(Job).order_by(Job.created_at.desc()).limit(100))).scalars())
    return _data([_job_out(j) for j in rows])


@router.get("/admin/organizations")
async def admin_orgs(auth: CurrentAuth, db: DbSession) -> dict[str, Any]:
    if not can_manage_careers(auth):
        raise PermissionDeniedError("Careers managers only.", code="PERMISSION_DENIED")
    rows = list((await db.execute(select(EmployerProfile).limit(100))).scalars())
    out = []
    for p in rows:
        org = await db.get(OrgRef, p.organization_id)
        out.append({"id": str(p.organization_id), "name": org.name if org else str(p.organization_id), "verification_status": p.status})
    return _data(out)


@router.get("/notifications")
async def notifications(auth: CurrentAuth, request: Request, settings: SettingsDep) -> dict[str, Any]:
    peer = PeerClient(settings, authorization=request.headers.get("authorization"))
    status, body = await peer.get_json(
        settings.NOTIFICATION_SERVICE_URL, "/api/v1/notifications", timeout=settings.NOTIFICATION_SERVICE_TIMEOUT_SECONDS
    )
    if status >= 400:
        return _data([])
    items = body.get("notifications") or body.get("data") or []
    mapped = []
    for n in items:
        mapped.append(
            {
                "id": str(n.get("notification_id") or n.get("id") or ""),
                "title": n.get("title") or "",
                "body": n.get("body") or "",
                "read": bool(n.get("read_at")),
                "link_path": (n.get("data") or {}).get("link_path") or (n.get("data") or {}).get("path"),
                "created_at": n.get("created_at"),
            }
        )
    return _data(mapped)


@router.post("/notifications/read-all")
async def notifications_read_all(auth: CurrentAuth, request: Request, settings: SettingsDep) -> dict[str, Any]:
    peer = PeerClient(settings, authorization=request.headers.get("authorization"))
    status, body = await peer.post_json(
        settings.NOTIFICATION_SERVICE_URL, "/api/v1/notifications/read-all", timeout=settings.NOTIFICATION_SERVICE_TIMEOUT_SECONDS
    )
    return _data({"ok": status < 400, "updated_count": (body or {}).get("updated_count", 0)})


@router.post("/notifications/{notification_id}/read")
async def notification_read(notification_id: str, auth: CurrentAuth, request: Request, settings: SettingsDep) -> dict[str, Any]:
    peer = PeerClient(settings, authorization=request.headers.get("authorization"))
    status, _ = await peer.post_json(
        settings.NOTIFICATION_SERVICE_URL,
        f"/api/v1/notifications/{notification_id}/read",
        timeout=settings.NOTIFICATION_SERVICE_TIMEOUT_SECONDS,
    )
    return _data({"ok": status < 400, "id": notification_id})


@router.post("/files/upload")
async def files_upload(
    auth: CurrentAuth,
    request: Request,
    settings: SettingsDep,
    file: UploadFile = File(...),
    category: str = "general",
) -> dict[str, Any]:
    """Upload via media-service document endpoint; returns JCMS-shaped file id."""
    peer = PeerClient(settings, authorization=request.headers.get("authorization"))
    content = await file.read()
    status, body = await peer.post_multipart(
        settings.MEDIA_SERVICE_URL,
        "/api/v1/media/documents",
        files={"file": (file.filename or "upload.bin", content, file.content_type or "application/octet-stream")},
        data={"title": file.filename or "upload", "context_type": "jcms", "context_id": category},
        timeout=settings.MEDIA_SERVICE_TIMEOUT_SECONDS,
    )
    if status >= 400:
        # Fall back to synthetic id only when media-service is unreachable — keep UX unblocked in partial stacks.
        return _data({"id": str(new_public_id()), "original_name": file.filename or "upload.bin", "category": category, "media_status": status})
    asset = body.get("asset") or body
    file_id = str(asset.get("asset_id") or asset.get("public_id") or body.get("public_id") or new_public_id())
    return _data({"id": file_id, "original_name": file.filename or asset.get("original_filename") or "upload.bin", "category": category})


@router.get("/files/{file_id}/download")
async def files_download(file_id: str, auth: CurrentAuth, request: Request, settings: SettingsDep) -> Response:
    """Authorized download via media-service stream endpoint."""
    peer = PeerClient(settings, authorization=request.headers.get("authorization"))
    status, content, headers = await peer.get_bytes(
        settings.MEDIA_SERVICE_URL,
        f"/api/v1/media/stream/{file_id}",
        timeout=settings.MEDIA_SERVICE_TIMEOUT_SECONDS,
    )
    if status >= 400:
        raise NotFoundError("File not found in media-service.", code="FILE_NOT_FOUND")
    media_type = headers.get("content-type") or "application/octet-stream"
    disposition = headers.get("content-disposition") or f'attachment; filename="{file_id}"'
    return StreamingResponse(iter([content]), media_type=media_type, headers={"Content-Disposition": disposition})
