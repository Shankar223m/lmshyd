"""Organizations asking to join the platform. Public to submit (rate limited); only a super admin sees or decides them."""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Path, Query
from pydantic import EmailStr, Field
from sqlalchemy import func, select

from app.api.deps import CurrentAuth, DbSession, RequestCtx, rate_limit, require_roles
from app.api.responses import errors
from app.core.exceptions import ConflictError, NotFoundError, ValidationFailedError
from app.core.time import utcnow
from app.models.organization_request import OrganizationRequest
from app.permissions.roles import Role
from app.schemas.common import PageContext, RequestSchema, ResponseSchema, SuccessResponse
from app.schemas.types import PublicIdOut, Timestamp, text

router = APIRouter(prefix="/organization-requests", tags=["Organization requests"])


class OrganizationRequestIn(RequestSchema):
    name: text(200)  # type: ignore[valid-type]
    org_type: text(60)  # type: ignore[valid-type]
    official_email: EmailStr
    phone: text(30)  # type: ignore[valid-type]
    website: text(300) | None = None  # type: ignore[valid-type]
    country: text(80)  # type: ignore[valid-type]
    state: text(80)  # type: ignore[valid-type]
    city: text(80)  # type: ignore[valid-type]
    address: text(300)  # type: ignore[valid-type]
    size: text(20)  # type: ignore[valid-type]
    owner_name: text(120)  # type: ignore[valid-type]
    owner_email: EmailStr
    owner_phone: text(30)  # type: ignore[valid-type]
    owner_designation: text(80)  # type: ignore[valid-type]


class OrganizationRequestOut(ResponseSchema):
    request_id: PublicIdOut = Field(validation_alias="public_id")
    name: str
    org_type: str
    official_email: str
    phone: str
    website: str | None
    country: str
    state: str
    city: str
    address: str
    size: str
    owner_name: str
    owner_email: str
    owner_phone: str
    owner_designation: str
    status: str
    decision_note: str | None
    created_at: Timestamp
    decided_at: Timestamp | None


class OrganizationRequestResponse(SuccessResponse):
    request: OrganizationRequestOut


class OrganizationRequestListResponse(SuccessResponse):
    requests: list[OrganizationRequestOut]
    page_context: PageContext


class Decision(RequestSchema):
    note: text(500) | None = None  # type: ignore[valid-type]


SuperAdminOnly = Depends(require_roles(Role.SUPER_ADMIN))
RequestIdParam = Annotated[str, Path(description="request_id")]


@router.post(
    "",
    response_model=OrganizationRequestResponse,
    status_code=201,
    dependencies=[Depends(rate_limit("org_request", "SIGNUP_RATE_LIMIT_PER_HOUR", 3600))],
    summary="Ask for an organization workspace",
    description="Public. No password is collected: if the request is approved, the owner gets the usual emailed link to set one.",
    responses=errors(409, 422, 429),
)
async def submit(data: OrganizationRequestIn, db: DbSession, ctx: RequestCtx) -> OrganizationRequestResponse:
    owner = str(data.owner_email).lower()
    pending = (await db.execute(select(OrganizationRequest.id).where(OrganizationRequest.owner_email == owner, OrganizationRequest.status == "pending"))).first()
    if pending:
        raise ConflictError("A request from this email is already waiting for review.", code="REQUEST_ALREADY_PENDING")
    row = OrganizationRequest(
        name=data.name, org_type=data.org_type, official_email=str(data.official_email).lower(), phone=data.phone, website=data.website,
        country=data.country, state=data.state, city=data.city, address=data.address, size=data.size, owner_name=data.owner_name,
        owner_email=owner, owner_phone=data.owner_phone, owner_designation=data.owner_designation, request_ip=getattr(ctx, "ip_address", None),
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return OrganizationRequestResponse(message="Request received. We will review it and email the owner.", request=OrganizationRequestOut.model_validate(row, from_attributes=True))


@router.get("", response_model=OrganizationRequestListResponse, dependencies=[SuperAdminOnly], summary="Requests waiting for a decision (super admin)", responses=errors(401, 403))
async def list_requests(
    auth: CurrentAuth, db: DbSession, status: Annotated[Literal["pending", "approved", "rejected"] | None, Query()] = None,
    page: Annotated[int, Query(ge=1, le=1000)] = 1, per_page: Annotated[int, Query(ge=1, le=100)] = 25,
) -> OrganizationRequestListResponse:
    query = select(OrganizationRequest)
    if status:
        query = query.where(OrganizationRequest.status == status)
    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar_one()
    rows = (await db.execute(query.order_by(OrganizationRequest.created_at.desc()).offset((page - 1) * per_page).limit(per_page))).scalars().all()
    return OrganizationRequestListResponse(
        message="", requests=[OrganizationRequestOut.model_validate(r, from_attributes=True) for r in rows],
        page_context=PageContext.build(page=page, per_page=per_page, total=total, is_exact=True, sort_column="created_time", sort_order="desc"),
    )


async def _decide(request_id: str, status: str, note: str | None, auth: CurrentAuth, db: DbSession) -> OrganizationRequestResponse:
    if not request_id.isdigit():
        raise ValidationFailedError("Invalid request id.")
    row = (await db.execute(select(OrganizationRequest).where(OrganizationRequest.public_id == int(request_id)).with_for_update())).scalars().first()
    if row is None:
        raise NotFoundError("Request not found.", code="REQUEST_NOT_FOUND")
    if row.status != "pending":
        raise ConflictError("This request was already decided.", code="REQUEST_ALREADY_DECIDED")
    row.status, row.decision_note, row.decided_by, row.decided_at = status, note, auth.user.public_id, utcnow()
    await db.commit()
    return OrganizationRequestResponse(message=f"Request {status}.", request=OrganizationRequestOut.model_validate(row, from_attributes=True))


@router.post("/{request_id}/approve", response_model=OrganizationRequestResponse, dependencies=[SuperAdminOnly], summary="Approve (super admin)", description="Marks it approved. Create the institution and its head from the Institutions and People screens; the head receives the emailed setup link.", responses=errors(401, 403, 404, 409))
async def approve(request_id: RequestIdParam, data: Decision, auth: CurrentAuth, db: DbSession) -> OrganizationRequestResponse:
    return await _decide(request_id, "approved", data.note, auth, db)


@router.post("/{request_id}/reject", response_model=OrganizationRequestResponse, dependencies=[SuperAdminOnly], summary="Reject (super admin)", responses=errors(401, 403, 404, 409))
async def reject(request_id: RequestIdParam, data: Decision, auth: CurrentAuth, db: DbSession) -> OrganizationRequestResponse:
    return await _decide(request_id, "rejected", data.note, auth, db)
