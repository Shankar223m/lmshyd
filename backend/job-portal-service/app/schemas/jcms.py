"""Request/response schemas for JCMS-parity recruiter, interview, offer-approval, and placement APIs."""

from datetime import date, datetime
from typing import Annotated

from lms_common.envelopes import PageContext, RequestSchema, ResponseSchema, SuccessResponse
from pydantic import Field

from app.schemas.types import PublicIdOut, Timestamp, id_field, multiline_text, text


class RecruiterAssignRequest(RequestSchema):
    recruiter_user_ids: Annotated[list[int], Field(max_length=50)] = Field(default_factory=list)


class RecruiterAssignmentOut(ResponseSchema):
    recruiter_user_id: int
    assigned_by: int
    created_at: Timestamp


class RecruiterAssignmentsResponse(SuccessResponse):
    assignments: list[RecruiterAssignmentOut]


class ScheduleInterviewRequest(RequestSchema):
    round_name: text(100)  # type: ignore[valid-type]
    format: str = Field(default="online", pattern="^(online|onsite|phone)$")
    starts_at: datetime
    ends_at: datetime
    timezone: str = Field(default="Asia/Kolkata", max_length=64)
    meeting_link: text(500) | None = None  # type: ignore[valid-type]
    instructions: multiline_text(2_000) | None = None  # type: ignore[valid-type]
    panel_user_ids: Annotated[list[int], Field(max_length=20)] = Field(default_factory=list)


class ScorecardRequest(RequestSchema):
    technical_skills: int | None = Field(default=None, ge=1, le=5)
    problem_solving: int | None = Field(default=None, ge=1, le=5)
    communication: int | None = Field(default=None, ge=1, le=5)
    culture_fit: int | None = Field(default=None, ge=1, le=5)
    comments: multiline_text(2_000) | None = None  # type: ignore[valid-type]
    recommendation: text(40) | None = None  # type: ignore[valid-type]


class RescheduleRequest(RequestSchema):
    starts_at: datetime
    ends_at: datetime
    reason: multiline_text(1_000) | None = None  # type: ignore[valid-type]


class RescheduleRespondRequest(RequestSchema):
    approve: bool
    comment: text(500) | None = None  # type: ignore[valid-type]


class InterviewOut(ResponseSchema):
    interview_id: PublicIdOut
    application_id: PublicIdOut | None = None
    job_id: PublicIdOut | None = None
    round_name: str
    format: str
    starts_at: Timestamp
    ends_at: Timestamp
    timezone: str
    meeting_link: str | None
    instructions: str | None
    status: str
    outcome: str | None = None


class InterviewResponse(SuccessResponse):
    interview: InterviewOut


class InterviewPage(SuccessResponse):
    interviews: list[InterviewOut]
    page_context: PageContext


class ScorecardOut(ResponseSchema):
    technical_skills: int | None
    problem_solving: int | None
    communication: int | None
    culture_fit: int | None
    comments: str | None
    recommendation: str | None


class ScorecardResponse(SuccessResponse):
    scorecard: ScorecardOut


class RescheduleOut(ResponseSchema):
    request_id: PublicIdOut
    interview_id: PublicIdOut | None = None
    status: str
    requested_starts_at: Timestamp
    requested_ends_at: Timestamp
    reason: str | None = None


class RescheduleResponse(SuccessResponse):
    request: RescheduleOut


class PlacementDetailsRequest(RequestSchema):
    designation: text(160) | None = None  # type: ignore[valid-type]
    joining_date: date | None = None
    annual_package: int | None = Field(default=None, ge=0)
    work_location: text(160) | None = None  # type: ignore[valid-type]


class PlacementEvidenceRequest(RequestSchema):
    media_asset_id: int = Field(ge=1)
    category: text(40)  # type: ignore[valid-type]


class PlacementReviewRequest(RequestSchema):
    action: str = Field(pattern="^(verify|request_changes|reject)$")
    comment: text(500) | None = None  # type: ignore[valid-type]


class PlacementEvidenceOut(ResponseSchema):
    evidence_id: PublicIdOut
    media_asset_id: int
    category: str
    status: str
    rejection_reason: str | None = None


class PlacementOut(ResponseSchema):
    placement_id: PublicIdOut
    status: str
    designation: str | None
    joining_date: date | None
    annual_package: int | None
    currency: str
    work_location: str | None
    verifier_comment: str | None = None
    evidence: list[PlacementEvidenceOut] = Field(default_factory=list)


class PlacementResponse(SuccessResponse):
    placement: PlacementOut


class PlacementPage(SuccessResponse):
    placements: list[PlacementOut]


class StudentOfferOut(ResponseSchema):
    offer_id: PublicIdOut
    application_id: PublicIdOut
    ctc: int
    currency: str
    joining_date: date | None
    role_title: str
    location: str | None = None
    status: str
    expires_at: Timestamp
    requires_approval: bool = False
    offer_letter_media_id: int | None = None


class StudentOfferPage(SuccessResponse):
    offers: list[StudentOfferOut]
