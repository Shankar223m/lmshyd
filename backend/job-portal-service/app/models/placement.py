"""Student placement records and evidence after an offer is accepted (JCMS parity)."""

from datetime import date
from typing import Any

from sqlalchemy import BigInteger, Date, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.domain.enums import PlacementEvidenceStatus, PlacementStatus


class Placement(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "placements"

    public_id: Mapped[int] = mapped_column(BigInteger, unique=True)
    application_id: Mapped[Any] = mapped_column(ForeignKey("applications.id", ondelete="CASCADE"), unique=True)
    offer_id: Mapped[Any] = mapped_column(ForeignKey("offers.id", ondelete="CASCADE"))
    student_user_id: Mapped[int] = mapped_column(BigInteger)
    institution_id: Mapped[int | None] = mapped_column(BigInteger)
    employer_org_id: Mapped[int] = mapped_column(BigInteger)
    job_id: Mapped[Any] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"))
    designation: Mapped[str | None] = mapped_column(String(160))
    joining_date: Mapped[date | None] = mapped_column(Date)
    annual_package: Mapped[int | None] = mapped_column(BigInteger)
    currency: Mapped[str] = mapped_column(String(3), default="INR")
    work_location: Mapped[str | None] = mapped_column(String(160))
    status: Mapped[str] = mapped_column(String(24), default=PlacementStatus.PENDING_DETAILS)
    verifier_comment: Mapped[str | None] = mapped_column(Text)
    verified_by: Mapped[int | None] = mapped_column(BigInteger)

    __table_args__ = (
        Index("ix_placements_student", "student_user_id", "status"),
        Index("ix_placements_institution", "institution_id", "status"),
        Index("ix_placements_employer", "employer_org_id", "status"),
    )


class PlacementEvidence(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "placement_evidence"

    public_id: Mapped[int] = mapped_column(BigInteger, unique=True)
    placement_id: Mapped[Any] = mapped_column(ForeignKey("placements.id", ondelete="CASCADE"))
    media_asset_id: Mapped[int] = mapped_column(BigInteger)  # media-service public id
    category: Mapped[str] = mapped_column(String(40))  # offer_letter | payslip | id_proof | other
    status: Mapped[str] = mapped_column(String(16), default=PlacementEvidenceStatus.PENDING)
    rejection_reason: Mapped[str | None] = mapped_column(Text)
    reviewed_by: Mapped[int | None] = mapped_column(BigInteger)

    __table_args__ = (
        Index("ix_placement_evidence_placement", "placement_id", "status"),
        UniqueConstraint("public_id", name="uq_placement_evidence_public_id"),
    )
