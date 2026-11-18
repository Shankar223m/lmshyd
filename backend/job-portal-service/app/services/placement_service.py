"""Placement records and evidence review after offer acceptance."""

from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.exceptions import ConflictError, NotFoundError, PermissionDeniedError, ValidationFailedError
from app.core.ids import new_public_id
from app.core.security import AccessTokenClaims
from app.domain.enums import PlacementEvidenceStatus, PlacementStatus
from app.models.application import Application
from app.models.job import Job
from app.models.offer import Offer
from app.models.placement import Placement, PlacementEvidence
from app.permissions.policy import is_institution_staff
from app.services.outbox import write_event


class PlacementService:
    def __init__(self, db: AsyncSession, settings: Settings) -> None:
        self.db = db
        self.settings = settings

    async def create_from_accepted_offer(self, application: Application, job: Job, offer: Offer) -> Placement:
        existing = (await self.db.execute(select(Placement).where(Placement.application_id == application.id))).scalar_one_or_none()
        if existing is not None:
            return existing
        placement = Placement(
            public_id=new_public_id(),
            application_id=application.id,
            offer_id=offer.id,
            student_user_id=application.user_id,
            institution_id=application.organization_id,
            employer_org_id=job.employer_org_id,
            job_id=job.id,
            designation=offer.role_title,
            joining_date=offer.joining_date,
            annual_package=offer.ctc,
            currency=offer.currency,
            work_location=offer.location,
            status=PlacementStatus.PENDING_DETAILS,
        )
        self.db.add(placement)
        await self.db.flush()
        write_event(
            self.db, event_type="placement.created", aggregate_type="placement", aggregate_id=placement.id,
            payload={
                "placement_id": str(placement.public_id),
                "application_id": str(application.public_id),
                "user_id": str(application.user_id),
                "organization_id": str(application.organization_id) if application.organization_id else None,
            },
        )
        return placement

    async def list_for_student(self, user_id: int) -> list[Placement]:
        return list((await self.db.execute(select(Placement).where(Placement.student_user_id == user_id).order_by(Placement.created_at.desc()))).scalars())

    async def get_for_student(self, user_id: int, public_id: int) -> Placement:
        placement = (await self.db.execute(select(Placement).where(Placement.public_id == public_id))).scalar_one_or_none()
        if placement is None or placement.student_user_id != user_id:
            raise NotFoundError("Placement not found.", code="PLACEMENT_NOT_FOUND")
        return placement

    async def submit_details(
        self,
        user_id: int,
        public_id: int,
        *,
        designation: str | None,
        joining_date: date | None,
        annual_package: int | None,
        work_location: str | None,
    ) -> Placement:
        placement = await self.get_for_student(user_id, public_id)
        if placement.status not in {PlacementStatus.PENDING_DETAILS, PlacementStatus.NEEDS_REVIEW}:
            raise ConflictError("Placement details cannot be edited in this state.", code="INVALID_STATE")
        if designation:
            placement.designation = designation
        if joining_date:
            placement.joining_date = joining_date
        if annual_package is not None:
            placement.annual_package = annual_package
        if work_location:
            placement.work_location = work_location
        await self.db.commit()
        return placement

    async def add_evidence(self, user_id: int, public_id: int, *, media_asset_id: int, category: str) -> PlacementEvidence:
        placement = await self.get_for_student(user_id, public_id)
        if placement.status in {PlacementStatus.VERIFIED, PlacementStatus.WITHDRAWN}:
            raise ConflictError("Evidence cannot be added in this state.", code="INVALID_STATE")
        if not category:
            raise ValidationFailedError(details=[{"field": "category", "code": "REQUIRED", "message": "Evidence category is required"}])
        evidence = PlacementEvidence(
            public_id=new_public_id(),
            placement_id=placement.id,
            media_asset_id=media_asset_id,
            category=category,
            status=PlacementEvidenceStatus.PENDING,
        )
        placement.status = PlacementStatus.PENDING_VERIFICATION
        self.db.add(evidence)
        write_event(
            self.db, event_type="placement.evidence_submitted", aggregate_type="placement", aggregate_id=placement.id,
            payload={"placement_id": str(placement.public_id), "evidence_id": str(evidence.public_id), "user_id": str(user_id)},
        )
        await self.db.commit()
        return evidence

    async def list_evidence(self, placement: Placement) -> list[PlacementEvidence]:
        return list((await self.db.execute(select(PlacementEvidence).where(PlacementEvidence.placement_id == placement.id))).scalars())

    async def list_for_institution(self, institution_id: int, *, status: str | None = None) -> list[Placement]:
        q = select(Placement).where(Placement.institution_id == institution_id).order_by(Placement.created_at.desc())
        if status:
            q = q.where(Placement.status == status)
        return list((await self.db.execute(q)).scalars())

    async def review(
        self, auth: AccessTokenClaims, placement_public_id: int, *, action: str, comment: str | None
    ) -> Placement:
        if not is_institution_staff(auth):
            raise PermissionDeniedError("Only institution staff can review placements.", code="INSTITUTION_ONLY")
        placement = (await self.db.execute(select(Placement).where(Placement.public_id == placement_public_id))).scalar_one_or_none()
        if placement is None or placement.institution_id != auth.organization_id:
            raise NotFoundError("Placement not found.", code="PLACEMENT_NOT_FOUND")
        action = action.lower().strip()
        if action == "verify":
            placement.status = PlacementStatus.VERIFIED
        elif action in {"request_changes", "needs_review"}:
            placement.status = PlacementStatus.NEEDS_REVIEW
        elif action == "reject":
            placement.status = PlacementStatus.REJECTED
        else:
            raise ValidationFailedError(details=[{"field": "action", "code": "INVALID", "message": "action must be verify, request_changes, or reject"}])
        placement.verifier_comment = comment
        placement.verified_by = auth.user_id
        for evidence in await self.list_evidence(placement):
            if evidence.status == PlacementEvidenceStatus.PENDING:
                evidence.status = PlacementEvidenceStatus.APPROVED if action == "verify" else PlacementEvidenceStatus.REJECTED
                evidence.reviewed_by = auth.user_id
                if action == "reject":
                    evidence.rejection_reason = comment
        write_event(
            self.db, event_type="placement.reviewed", aggregate_type="placement", aggregate_id=placement.id,
            payload={"placement_id": str(placement.public_id), "action": action, "status": placement.status},
        )
        await self.db.commit()
        return placement
