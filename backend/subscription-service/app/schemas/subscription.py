from lms_common.envelopes import PageContext, RequestSchema, ResponseSchema, SuccessResponse
from pydantic import Field

from app.schemas.types import PublicIdOut, Timestamp, id_field, text

RequestCourseId = id_field("course_id", "1755000000003555")
RequestOrganizationId = id_field("organization_id", "1755000000001234")

CancelReason = text(500, min_length=3, examples=["Institution requested early termination"])


class SubscriptionGrantCreate(RequestSchema):
    """Admin assigns a course to an institution without a prior course request."""

    organization_id: RequestOrganizationId  # type: ignore[valid-type]
    course_id: RequestCourseId  # type: ignore[valid-type]
    seats: int = Field(default=100, gt=0, le=100_000)
    term_days: int = Field(default=365, gt=0, le=3_650)


class CancelRequest(RequestSchema):
    reason: CancelReason  # type: ignore[valid-type]


class SubscriptionOut(ResponseSchema):
    subscription_id: PublicIdOut = Field(validation_alias="public_id")
    organization_id: PublicIdOut
    course_id: PublicIdOut
    seats_total: int
    seats_used: int
    starts_at: Timestamp
    ends_at: Timestamp
    status: str
    cancelled_at: Timestamp | None = None
    cancelled_reason: str | None = None
    created_at: Timestamp


class SubscriptionResponse(SuccessResponse):
    subscription: SubscriptionOut


class SubscriptionListResponse(SuccessResponse):
    subscriptions: list[SubscriptionOut]
    page_context: PageContext
