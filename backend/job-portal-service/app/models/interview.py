"""Scheduled (human) interviews — distinct from AI interview pipeline stages."""

from datetime import datetime
from typing import Any

from sqlalchemy import BigInteger, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.db.types import JSONType
from app.domain.enums import InterviewStatus, RescheduleStatus


class Interview(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "interviews"

    public_id: Mapped[int] = mapped_column(BigInteger, unique=True)
    application_id: Mapped[Any] = mapped_column(ForeignKey("applications.id", ondelete="CASCADE"))
    job_id: Mapped[Any] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"))
    employer_org_id: Mapped[int] = mapped_column(BigInteger)
    student_user_id: Mapped[int] = mapped_column(BigInteger)
    round_name: Mapped[str] = mapped_column(String(100))
    format: Mapped[str] = mapped_column(String(20), default="online")  # online | onsite | phone
    starts_at: Mapped[datetime]
    ends_at: Mapped[datetime]
    timezone: Mapped[str] = mapped_column(String(64), default="Asia/Kolkata")
    meeting_link: Mapped[str | None] = mapped_column(String(500))
    instructions: Mapped[str | None] = mapped_column(Text)
    panel_user_ids: Mapped[list[int]] = mapped_column(JSONType, default=list)
    status: Mapped[str] = mapped_column(String(24), default=InterviewStatus.SCHEDULED)
    outcome: Mapped[str | None] = mapped_column(String(100))
    created_by: Mapped[int] = mapped_column(BigInteger)

    __table_args__ = (
        Index("ix_interviews_application", "application_id", "starts_at"),
        Index("ix_interviews_student", "student_user_id", "starts_at"),
        Index("ix_interviews_employer", "employer_org_id", "status"),
        Index("ix_interviews_job", "job_id"),
    )


class InterviewScorecard(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "interview_scorecards"

    interview_id: Mapped[Any] = mapped_column(ForeignKey("interviews.id", ondelete="CASCADE"), unique=True)
    technical_skills: Mapped[int | None] = mapped_column(Integer)
    problem_solving: Mapped[int | None] = mapped_column(Integer)
    communication: Mapped[int | None] = mapped_column(Integer)
    culture_fit: Mapped[int | None] = mapped_column(Integer)
    comments: Mapped[str | None] = mapped_column(Text)
    recommendation: Mapped[str | None] = mapped_column(String(40))
    submitted_by: Mapped[int] = mapped_column(BigInteger)


class InterviewRescheduleRequest(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "interview_reschedule_requests"

    public_id: Mapped[int] = mapped_column(BigInteger, unique=True)
    interview_id: Mapped[Any] = mapped_column(ForeignKey("interviews.id", ondelete="CASCADE"))
    student_user_id: Mapped[int] = mapped_column(BigInteger)
    requested_starts_at: Mapped[datetime]
    requested_ends_at: Mapped[datetime]
    reason: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(16), default=RescheduleStatus.PENDING)
    reviewer_user_id: Mapped[int | None] = mapped_column(BigInteger)
    reviewer_comment: Mapped[str | None] = mapped_column(Text)

    __table_args__ = (
        Index("ix_interview_reschedule_interview", "interview_id", "status"),
        UniqueConstraint("public_id", name="uq_interview_reschedule_requests_public_id"),
    )
