"""Service-to-service endpoints (shared internal token). catalog-service shows admins which institutions hold a course."""

from typing import Annotated

from fastapi import APIRouter, Query
from lms_common.envelopes import SuccessResponse
from pydantic import BaseModel
from sqlalchemy import select

from app.api.deps import DbSession, RequireInternalCaller
from app.api.responses import errors
from app.core.time import utcnow
from app.domain.enums import SubscriptionStatus
from app.models.institution_ref import InstitutionRef
from app.models.subscription import Subscription

router = APIRouter(prefix="/internal", tags=["Internal"], dependencies=[RequireInternalCaller])


class CourseInstitution(BaseModel):
    organization_id: str
    institution_name: str
    seats_total: int
    starts_at: str
    ends_at: str


class CourseInstitutionsResponse(SuccessResponse):
    institutions: dict[str, list[CourseInstitution]]  # by course id: who holds it right now


@router.get(
    "/courses/institutions",
    response_model=CourseInstitutionsResponse,
    summary="Which institutions hold each of these courses right now",
    description="Requires `X-Internal-Service-Token`. Active subscriptions only (started, not ended, not cancelled).",
    responses=errors(403, 422),
)
async def course_institutions(
    db: DbSession, course_ids: Annotated[str, Query(description="Comma-separated course ids (at most 200)", max_length=4000)]
) -> CourseInstitutionsResponse:
    ids = sorted({int(part) for part in course_ids.split(",") if part.strip().isdigit()})[:200]
    out: dict[str, list[CourseInstitution]] = {str(i): [] for i in ids}
    if ids:
        now = utcnow()
        rows = await db.execute(
            select(Subscription, InstitutionRef.name)
            .join(InstitutionRef, InstitutionRef.organization_id == Subscription.organization_id)
            .where(
                Subscription.course_id.in_(ids), Subscription.status == SubscriptionStatus.ACTIVE,
                Subscription.starts_at <= now, Subscription.ends_at > now,
            )
        )
        for subscription, name in rows.all():
            out[str(subscription.course_id)].append(
                CourseInstitution(
                    organization_id=str(subscription.organization_id), institution_name=name, seats_total=subscription.seats_total,
                    starts_at=subscription.starts_at.isoformat(), ends_at=subscription.ends_at.isoformat(),
                )
            )
    return CourseInstitutionsResponse(message="Institutions retrieved successfully.", institutions=out)
