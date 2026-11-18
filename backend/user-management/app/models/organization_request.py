from datetime import datetime

from sqlalchemy import BigInteger, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.ids import new_public_id
from app.db.base import Base, CreatedAtMixin, UUIDPrimaryKeyMixin


class OrganizationRequest(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    """Someone asked for an organization workspace. Nothing is created from it automatically: a super admin reviews it,
    then creates the institution and its head through the normal screens (so the owner gets the usual emailed setup
    link and no password is ever collected here)."""

    __tablename__ = "organization_requests"

    public_id: Mapped[int] = mapped_column(BigInteger, unique=True, default=new_public_id)
    name: Mapped[str] = mapped_column(String(200))
    org_type: Mapped[str] = mapped_column(String(60))
    official_email: Mapped[str] = mapped_column(String(254))
    phone: Mapped[str] = mapped_column(String(30))
    website: Mapped[str | None] = mapped_column(String(300))
    country: Mapped[str] = mapped_column(String(80))
    state: Mapped[str] = mapped_column(String(80))
    city: Mapped[str] = mapped_column(String(80))
    address: Mapped[str] = mapped_column(String(300))
    size: Mapped[str] = mapped_column(String(20))
    owner_name: Mapped[str] = mapped_column(String(120))
    owner_email: Mapped[str] = mapped_column(String(254))  # lower-cased
    owner_phone: Mapped[str] = mapped_column(String(30))
    owner_designation: Mapped[str] = mapped_column(String(80))
    status: Mapped[str] = mapped_column(String(10), default="pending", server_default="pending")  # pending | approved | rejected
    decision_note: Mapped[str | None] = mapped_column(String(500))
    decided_by: Mapped[int | None] = mapped_column(BigInteger)
    decided_at: Mapped[datetime | None]
    request_ip: Mapped[str | None] = mapped_column(String(45))

    __table_args__ = (Index("ix_organization_requests_status_created", "status", "created_at"), Index("ix_organization_requests_owner_email", "owner_email"))
