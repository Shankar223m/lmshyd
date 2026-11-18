
"""SQLAlchemy ORM models for admin delegation."""

from __future__ import annotations

import uuid

from sqlalchemy import (
    Boolean,
    Column,
    ForeignKey,
    Index,
    Table,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDPrimaryKeyMixin, TimestampMixin


class AdminDelegation(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "admin_delegations"

    admin_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    is_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )

    can_manage_individual_permissions: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )
    can_manage_role_templates: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )
    can_manage_institution_access: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )
    can_reset_individual_overrides: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )

    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    updated_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    admin_user: Mapped["User"] = relationship(
        "User",
        foreign_keys=[admin_user_id],
        lazy="raise",
        back_populates="delegations",
    )

    created_by: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[created_by_id],
        lazy="raise",
        back_populates="created_delegations",
    )

    updated_by: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[updated_by_id],
        lazy="raise",
        back_populates="updated_delegations",
    )

    institutions: Mapped[list["Institution"]] = relationship(
        "Institution",
        secondary="delegation_institutions",
        lazy="raise",
        back_populates="delegations",
    )

    __table_args__ = (
        UniqueConstraint("admin_user_id", name="uq_admin_delegation"),
        Index("ix_admin_delegations_user", "admin_user_id"),
    )


delegation_institutions = Table(
    "delegation_institutions",
    Base.metadata,
    Column(
        "delegation_id",
        Uuid,
        ForeignKey("admin_delegations.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "institution_id",
        Uuid,
        ForeignKey("institutions.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    UniqueConstraint(
        "delegation_id",
        "institution_id",
        name="uq_delegation_institution",
    ),
)
