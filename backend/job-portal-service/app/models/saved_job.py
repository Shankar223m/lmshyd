import uuid

from sqlalchemy import BigInteger, ForeignKey, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, CreatedAtMixin, UUIDPrimaryKeyMixin


class SavedJob(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    """A job a student bookmarked to come back to. Private to them; it says nothing to the employer."""

    __tablename__ = "saved_jobs"

    user_id: Mapped[int] = mapped_column(BigInteger)
    job_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"))

    __table_args__ = (UniqueConstraint("user_id", "job_id", name="uq_saved_jobs_user_job"), Index("ix_saved_jobs_user", "user_id", "created_at"))
