import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, ForeignKey, Index, SmallInteger, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.ids import new_public_id
from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.permissions.roles import InstitutionStatus

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.admin_delegation import AdminDelegation


class Institution(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """An organisation: an institution (school, college) or an employer (hiring company).

    ``public_id`` is the ``organization_id`` the API exposes. The table keeps its original name.
    """

    __tablename__ = "institutions"

    public_id: Mapped[int] = mapped_column(
        BigInteger, unique=True, default=new_public_id
    )
    name: Mapped[str] = mapped_column(String(200))
    code: Mapped[str] = mapped_column(String(20))  # stored upper-cased
    org_type: Mapped[str] = mapped_column(String(20), default="institution", server_default="institution")
    institution_type: Mapped[str | None] = mapped_column(String(40))  # institutions only
    custom_type: Mapped[str | None] = mapped_column(String(500), nullable=True, default=None)
    industry: Mapped[str | None] = mapped_column(String(100))  # employers only
    admin_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=True)

    email: Mapped[str] = mapped_column(String(254))
    phone: Mapped[str] = mapped_column(String(20))
    alternate_phone: Mapped[str | None] = mapped_column(String(20))
    website: Mapped[str | None] = mapped_column(String(500), nullable=True, default=None)
    linkedin_url: Mapped[str | None] = mapped_column(String(500), nullable=True, default=None)
    instagram_url: Mapped[str | None] = mapped_column(String(500), nullable=True, default=None)
    facebook_url: Mapped[str | None] = mapped_column(String(500), nullable=True, default=None)
    youtube_url: Mapped[str | None] = mapped_column(String(500), nullable=True, default=None)
    twitter_url: Mapped[str | None] = mapped_column(String(500), nullable=True, default=None)
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True, default=None)

    address_line1: Mapped[str] = mapped_column(String(255))
    address_line2: Mapped[str | None] = mapped_column(String(255))
    city: Mapped[str] = mapped_column(String(100))
    state: Mapped[str] = mapped_column(String(100))
    postal_code: Mapped[str] = mapped_column(String(12))
    country: Mapped[str] = mapped_column(String(2))

    timezone: Mapped[str] = mapped_column(String(64))
    registration_number: Mapped[str | None] = mapped_column(String(50))
    affiliation: Mapped[str | None] = mapped_column(String(100))
    established_year: Mapped[int | None] = mapped_column(SmallInteger)

    # White-label: the logo (see StoredImage) and the main brand colour, "#RRGGBB". image_version 0 = no logo.
    brand_color: Mapped[str | None] = mapped_column(String(7))
    image_version: Mapped[int] = mapped_column(default=0, server_default="0")

    status: Mapped[str] = mapped_column(
        String(32),
        default=InstitutionStatus.ACTIVE,
        server_default=InstitutionStatus.ACTIVE.value,
    )
    status_reason: Mapped[str | None] = mapped_column(String(500))
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    deleted_at: Mapped[datetime | None]

    admin: Mapped["User"] = relationship(
        foreign_keys=[admin_id], lazy="raise"
    )
    created_by: Mapped["User | None"] = relationship(
        foreign_keys=[created_by_id], lazy="raise"
    )

    # Reverse relationship for AdminDelegation.institutions
    delegations: Mapped[list["AdminDelegation"]] = relationship(
        "AdminDelegation",
        secondary="delegation_institutions",
        lazy="raise",
        back_populates="institutions",
    )

    @property
    def x_url(self) -> str | None:
        return self.twitter_url

    __table_args__ = (
        Index(
            "uq_institutions_code_active",
            "code",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
            sqlite_where=text("deleted_at IS NULL"),
        ),
        Index("ix_institutions_admin_id_status", "admin_id", "status"),
        Index("ix_institutions_created_at", "created_at"),
        Index("ix_institutions_org_type_created_at", "org_type", "created_at"),
    )
