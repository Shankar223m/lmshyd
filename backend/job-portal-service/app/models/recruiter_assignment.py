"""Which recruiters may act on which job (JCMS recruiter_assignments parity)."""

from typing import Any

from sqlalchemy import BigInteger, ForeignKey, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class JobRecruiterAssignment(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "job_recruiter_assignments"

    job_id: Mapped[Any] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"))
    recruiter_user_id: Mapped[int] = mapped_column(BigInteger)
    assigned_by: Mapped[int] = mapped_column(BigInteger)

    __table_args__ = (
        UniqueConstraint("job_id", "recruiter_user_id", name="uq_job_recruiter_assignments_job_user"),
        Index("ix_job_recruiter_assignments_recruiter", "recruiter_user_id"),
        Index("ix_job_recruiter_assignments_job", "job_id"),
    )
