"""One call for the student's Jobs home: every number, label and the "what to do next" hint is worked out here,
so the screen only draws what it is given."""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession, attach_request_id, require_roles
from app.api.v1.jobs import discover_jobs
from app.core.responses import success_data
from app.models.entities import Application, Interview, Job, Offer, Organization, Placement
from app.modules.identity.profile_completion import compute_profile_completion_percent
from app.shared.enums import ApplicationStatus, InterviewStatus, OfferStatus, PlacementStatus, UserRole

router = APIRouter(tags=["student-dashboard"])

_FINISHED_APPLICATION = {ApplicationStatus.REJECTED.value, ApplicationStatus.WITHDRAWN.value}
_DONE_INTERVIEW = {InterviewStatus.FEEDBACK_SUBMITTED.value, InterviewStatus.CANCELLED.value, InterviewStatus.NO_SHOW.value}
_PLACEMENT_LABELS = {
    PlacementStatus.PENDING_DETAILS.value: ("Add your details", "warning"),
    PlacementStatus.PENDING_VERIFICATION.value: ("Awaiting verification", "warning"),
    PlacementStatus.VERIFIED.value: ("Placed", "success"),
    PlacementStatus.NEEDS_REVIEW.value: ("Needs a second look", "warning"),
    PlacementStatus.REJECTED.value: ("Not verified", "danger"),
    PlacementStatus.WITHDRAWN.value: ("Withdrawn", "neutral"),
}
READY_PROFILE_PERCENT = 80


def _as_utc(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def _next_action(
    *, issued_offers: int, next_interview: dict | None, placement: dict | None, accepted_offer: bool, profile_percent: int, applications: int
) -> dict:
    """The single most useful next step, in priority order."""
    if issued_offers:
        noun = "offer" if issued_offers == 1 else "offers"
        return {"key": "respond_to_offer", "title": f"Respond to your {noun}", "detail": "An employer is waiting for your answer.", "to": "/jobs/student/offers"}
    if next_interview:
        return {
            "key": "prepare_interview",
            "title": f"Prepare for your {next_interview['round_name']} round",
            "detail": f"{next_interview['company_name'] or 'The employer'} · {next_interview['starts_at'][:10]}",
            "to": "/jobs/student/interviews",
        }
    if accepted_offer and (placement is None or placement["status"] in {PlacementStatus.PENDING_DETAILS.value, PlacementStatus.NEEDS_REVIEW.value}):
        return {"key": "submit_placement", "title": "Submit your placement details", "detail": "Your college verifies them to confirm your placement.", "to": "/jobs/student/placement"}
    if profile_percent < READY_PROFILE_PERCENT:
        return {"key": "complete_profile", "title": "Complete your profile", "detail": f"{profile_percent}% done. Employers see a complete profile first.", "to": "/jobs/student/profile"}
    if applications == 0:
        return {"key": "apply", "title": "Apply to an opening that fits you", "detail": "Openings you are eligible for are listed first.", "to": "/jobs/student/jobs"}
    return {"key": "track", "title": "Track your applications", "detail": "You will be told when an employer moves you forward.", "to": "/jobs/student/applications"}


@router.get("/students/me/dashboard")
def student_dashboard(db: DbSession, user: CurrentUser, request: Request, _: str = Depends(attach_request_id)):
    require_roles(UserRole.STUDENT)(user)
    now = datetime.now(UTC)

    applications = db.scalars(select(Application).where(Application.student_id == user.id).order_by(Application.created_at.desc())).all()
    app_ids = [a.id for a in applications] or ["none"]
    active = [a for a in applications if a.status not in _FINISHED_APPLICATION]

    interviews = db.scalars(select(Interview).where(Interview.application_id.in_(app_ids)).order_by(Interview.starts_at.asc())).all()
    upcoming = [i for i in interviews if _as_utc(i.ends_at) >= now and i.status not in _DONE_INTERVIEW]
    next_interview = None
    if upcoming:
        first = upcoming[0]
        application = db.get(Application, first.application_id)
        job = db.get(Job, application.job_id) if application else None
        org = db.get(Organization, job.organization_id) if job else None
        next_interview = {
            "interview_id": first.id,
            "round_name": first.round_name,
            "starts_at": first.starts_at.isoformat(),
            "job_title": job.title if job else None,
            "company_name": org.name if org else None,
        }

    offers = db.scalars(select(Offer).where(Offer.application_id.in_(app_ids))).all()
    issued_offers = sum(1 for o in offers if o.status == OfferStatus.ISSUED.value)
    accepted_offer = any(o.status == OfferStatus.ACCEPTED.value for o in offers)

    placement_row = db.scalar(select(Placement).where(Placement.student_id == user.id).order_by(Placement.created_at.desc()))
    placement = None
    if placement_row:
        label, tone = _PLACEMENT_LABELS.get(placement_row.status, (placement_row.status.replace("_", " ").title(), "neutral"))
        placement = {"status": placement_row.status, "label": label, "tone": tone, "designation": placement_row.designation}
    else:
        label, tone = ("Not placed yet", "neutral")

    profile_percent = compute_profile_completion_percent(user.student_profile)

    picks = discover_jobs(db, user, request, q=None, work_mode=None, employment_type=None, eligible_only=True, page=1, page_size=100, sort=None, _="")["data"]
    picks.sort(key=lambda j: j.get("match_percent") or 0, reverse=True)

    return success_data(
        {
            "stats": {
                "applications_total": len(applications),
                "applications_active": len(active),
                "interviews_upcoming": len(upcoming),
                "next_interview": next_interview,
                "offers_total": len(offers),
                "offers_awaiting_answer": issued_offers,
                "offer_accepted": accepted_offer,
            },
            "placement": placement or {"status": "NOT_PLACED", "label": label, "tone": tone, "designation": None},
            "profile_percent": profile_percent,
            "next_action": _next_action(
                issued_offers=issued_offers,
                next_interview=next_interview,
                placement=placement,
                accepted_offer=accepted_offer,
                profile_percent=profile_percent,
                applications=len(applications),
            ),
            "recommended_jobs": picks[:3],
        },
        request,
    )
