"""SQLAlchemy ORM model for per‑user permission overrides.

An Override represents an explicit **ALLOW** or **DENY** for a specific permission
key (the same string used throughout the permission system).  The absence of a
row means **INHERIT** – the user's effective permission is taken from the role
template.
"""

from __future__ import annotations

import enum
from uuid import UUID

from sqlalchemy import Enum, ForeignKey, String, Boolean, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

class PermissionEffect(str, enum.Enum):
    ALLOW = "allow"
    DENY = "deny"

class UserPermissionOverride(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "user_permission_overrides"

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    permission_key: Mapped[str] = mapped_column(String(128), nullable=False)
    effect: Mapped[PermissionEffect] = mapped_column(Enum(PermissionEffect), nullable=False)

    # Auditing – who created / updated the record
    created_by_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    updated_by_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Relationships – eager‑loading is avoided; the calling code must join as needed.
    user: Mapped["User"] = relationship(
    "User",
    lazy="raise",
    back_populates="permission_overrides",
    foreign_keys=[user_id],
)
    created_by: Mapped["User | None"] = relationship(
        "User", foreign_keys=[created_by_id], lazy="raise", back_populates="created_overrides"
    )
    updated_by: Mapped["User | None"] = relationship(
        "User", foreign_keys=[updated_by_id], lazy="raise", back_populates="updated_overrides"
    )

    __table_args__ = (
        UniqueConstraint("user_id", "permission_key", name="uq_user_permission"),
        Index("ix_user_permission_overrides_user_permission", "user_id", "permission_key"),
    )
