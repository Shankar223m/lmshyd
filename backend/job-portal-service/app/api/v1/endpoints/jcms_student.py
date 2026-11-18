"""Student JCMS screens: interviews, offers, placements."""

from fastapi import APIRouter
from sqlalchemy import select

from app.api.deps import DbSession, RequireStudent, SettingsDep, WriteRateLimit
from app.api.responses import AUTHENTICATED, errors
from app.core.exceptions import NotFoundError
from app.core.ids import parse_public_id
from app.models.interview import Interview
from app.schemas.jcms import (
    InterviewOut,
    InterviewPage,
    PlacementDetailsRequest,
    PlacementEvidenceOut,
    PlacementEvidenceRequest,
    PlacementOut,
    PlacementPage,
    PlacementResponse,
    RescheduleOut,
    RescheduleRequest,
    RescheduleResponse,
    StudentOfferOut,
    StudentOfferPage,
)
from app.services.interview_service import InterviewService
from app.services.offer_service import OfferService
from app.services.placement_service import PlacementService
from lms_common.envelopes import PageContext, SortOrder

router = APIRouter(tags=["Student JCMS workflows"])


@router.get("/interviews/me", response_model=InterviewPage, summary="My scheduled interviews", responses=errors(*AUTHENTICATED))
async def my_interviews(auth: RequireStudent, db: DbSession, settings: SettingsDep) -> InterviewPage:
    rows = await InterviewService(db, settings).list_for_student(auth.user_id)
    return InterviewPage(
        message="",
        interviews=[
            InterviewOut(
                interview_id=i.public_id, round_name=i.round_name, format=i.format,
                starts_at=i.starts_at, ends_at=i.ends_at, timezone=i.timezone,
                meeting_link=i.meeting_link, instructions=i.instructions, status=i.status, outcome=i.outcome,
            )
            for i in rows
        ],
        page_context=PageContext.build(page=1, per_page=max(len(rows), 1), total=len(rows), is_exact=True, sort_column="starts_at", sort_order=SortOrder.DESC),
    )


@router.post(
    "/interviews/{interview_id}/reschedule-request",
    response_model=RescheduleResponse,
    status_code=201,
    summary="Request to reschedule an interview",
    responses=errors(*AUTHENTICATED, 404, 409, 422),
    dependencies=[WriteRateLimit],
)
async def request_reschedule(interview_id: str, body: RescheduleRequest, auth: RequireStudent, db: DbSession, settings: SettingsDep) -> RescheduleResponse:
    pid = parse_public_id(interview_id)
    if pid is None:
        raise NotFoundError("Interview not found.", code="INTERVIEW_NOT_FOUND")
    req = await InterviewService(db, settings).request_reschedule(
        auth.user_id, pid, starts_at=body.starts_at, ends_at=body.ends_at, reason=body.reason
    )
    interview = (await db.execute(select(Interview).where(Interview.id == req.interview_id))).scalar_one()
    return RescheduleResponse(
        message="Reschedule requested.",
        request=RescheduleOut(
            request_id=req.public_id, interview_id=interview.public_id, status=req.status,
            requested_starts_at=req.requested_starts_at, requested_ends_at=req.requested_ends_at, reason=req.reason,
        ),
    )


@router.get("/offers/me", response_model=StudentOfferPage, summary="My offers", responses=errors(*AUTHENTICATED))
async def my_offers(auth: RequireStudent, db: DbSession, settings: SettingsDep) -> StudentOfferPage:
    rows = await OfferService(db, settings).list_for_student(auth.user_id)
    return StudentOfferPage(
        message="",
        offers=[
            StudentOfferOut(
                offer_id=offer.public_id, application_id=application.public_id, ctc=offer.ctc, currency=offer.currency,
                joining_date=offer.joining_date, role_title=offer.role_title, location=offer.location, status=offer.status,
                expires_at=offer.expires_at, requires_approval=offer.requires_approval, offer_letter_media_id=offer.offer_letter_media_id,
            )
            for offer, application in rows
        ],
    )


@router.get("/placements/me", response_model=PlacementPage, summary="My placements", responses=errors(*AUTHENTICATED))
async def my_placements(auth: RequireStudent, db: DbSession, settings: SettingsDep) -> PlacementPage:
    service = PlacementService(db, settings)
    rows = await service.list_for_student(auth.user_id)
    out: list[PlacementOut] = []
    for p in rows:
        evidence = await service.list_evidence(p)
        out.append(
            PlacementOut(
                placement_id=p.public_id, status=p.status, designation=p.designation, joining_date=p.joining_date,
                annual_package=p.annual_package, currency=p.currency, work_location=p.work_location,
                verifier_comment=p.verifier_comment,
                evidence=[
                    PlacementEvidenceOut(evidence_id=e.public_id, media_asset_id=e.media_asset_id, category=e.category, status=e.status, rejection_reason=e.rejection_reason)
                    for e in evidence
                ],
            )
        )
    return PlacementPage(message="", placements=out)


@router.patch("/placements/{placement_id}", response_model=PlacementResponse, summary="Submit placement details", responses=errors(*AUTHENTICATED, 404, 409), dependencies=[WriteRateLimit])
async def update_placement(placement_id: str, body: PlacementDetailsRequest, auth: RequireStudent, db: DbSession, settings: SettingsDep) -> PlacementResponse:
    pid = parse_public_id(placement_id)
    if pid is None:
        raise NotFoundError("Placement not found.", code="PLACEMENT_NOT_FOUND")
    service = PlacementService(db, settings)
    placement = await service.submit_details(
        auth.user_id, pid, designation=body.designation, joining_date=body.joining_date,
        annual_package=body.annual_package, work_location=body.work_location,
    )
    evidence = await service.list_evidence(placement)
    return PlacementResponse(
        message="Saved.",
        placement=PlacementOut(
            placement_id=placement.public_id, status=placement.status, designation=placement.designation,
            joining_date=placement.joining_date, annual_package=placement.annual_package, currency=placement.currency,
            work_location=placement.work_location, verifier_comment=placement.verifier_comment,
            evidence=[PlacementEvidenceOut(evidence_id=e.public_id, media_asset_id=e.media_asset_id, category=e.category, status=e.status, rejection_reason=e.rejection_reason) for e in evidence],
        ),
    )


@router.post(
    "/placements/{placement_id}/evidence",
    response_model=PlacementResponse,
    status_code=201,
    summary="Upload placement evidence document reference",
    responses=errors(*AUTHENTICATED, 404, 409, 422),
    dependencies=[WriteRateLimit],
)
async def add_placement_evidence(placement_id: str, body: PlacementEvidenceRequest, auth: RequireStudent, db: DbSession, settings: SettingsDep) -> PlacementResponse:
    pid = parse_public_id(placement_id)
    if pid is None:
        raise NotFoundError("Placement not found.", code="PLACEMENT_NOT_FOUND")
    service = PlacementService(db, settings)
    await service.add_evidence(auth.user_id, pid, media_asset_id=body.media_asset_id, category=body.category)
    placement = await service.get_for_student(auth.user_id, pid)
    evidence = await service.list_evidence(placement)
    return PlacementResponse(
        message="Evidence submitted.",
        placement=PlacementOut(
            placement_id=placement.public_id, status=placement.status, designation=placement.designation,
            joining_date=placement.joining_date, annual_package=placement.annual_package, currency=placement.currency,
            work_location=placement.work_location, verifier_comment=placement.verifier_comment,
            evidence=[PlacementEvidenceOut(evidence_id=e.public_id, media_asset_id=e.media_asset_id, category=e.category, status=e.status, rejection_reason=e.rejection_reason) for e in evidence],
        ),
    )
