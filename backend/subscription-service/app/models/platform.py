import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import BigInteger, Boolean, ForeignKey, Index, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, CreatedAtMixin, TimestampMixin, UUIDPrimaryKeyMixin
from app.db.types import JSONType


class CatalogProduct(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Something the marketplace sells (LMS, AI Resume Builder, ...). A new product is a row, not a code change."""

    __tablename__ = "catalog_products"

    key: Mapped[str] = mapped_column(String(40), unique=True)
    name: Mapped[str] = mapped_column(String(80))
    icon: Mapped[str] = mapped_column(String(30), default="sparkles", server_default="sparkles")
    tagline: Mapped[str] = mapped_column(String(160))
    description: Mapped[str] = mapped_column(String(1000))
    features: Mapped[list[str]] = mapped_column(JSONType, default=list)
    # Optional parts a buyer picks (for example LMS course modules): [{"key", "name", "monthly_price"}]
    modules: Mapped[list[dict[str, Any]]] = mapped_column(JSONType, default=list)
    position: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1")

    plans: Mapped[list["CatalogPlan"]] = relationship(order_by="CatalogPlan.monthly_price", cascade="all, delete-orphan", lazy="selectin")


class CatalogPlan(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "catalog_plans"

    product_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("catalog_products.id", ondelete="CASCADE"))
    key: Mapped[str] = mapped_column(String(40))
    name: Mapped[str] = mapped_column(String(60))
    monthly_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    seat_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0"), server_default="0")
    limits: Mapped[list[dict[str, str]]] = mapped_column(JSONType, default=list)  # [{"label", "value"}]
    highlight: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")

    __table_args__ = (UniqueConstraint("product_id", "key", name="uq_catalog_plans_product_key"),)


class ProductSubscription(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """One product, one owner (a person or an organization), its own plan and its own end date. Renewing extends this
    row, so the owner always has at most one per product and an expiry never touches another product's row."""

    __tablename__ = "product_subscriptions"

    public_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    owner_key: Mapped[str] = mapped_column(String(30))  # "u:<user id>" or "o:<organization id>"
    scope: Mapped[str] = mapped_column(String(14))  # individual | organization
    user_id: Mapped[int | None] = mapped_column(BigInteger)
    organization_id: Mapped[int | None] = mapped_column(BigInteger)
    product_key: Mapped[str] = mapped_column(String(40))
    plan_key: Mapped[str] = mapped_column(String(40))
    seats: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    module_keys: Mapped[list[str]] = mapped_column(JSONType, default=list)
    starts_at: Mapped[datetime]
    ends_at: Mapped[datetime]

    __table_args__ = (
        UniqueConstraint("owner_key", "product_key", name="uq_product_subscriptions_owner_product"),
        Index("ix_product_subscriptions_org", "organization_id"),
        Index("ix_product_subscriptions_user", "user_id"),
    )


class ProductAssignment(CreatedAtMixin, Base):
    """An organization gave one purchased product to one person. Seats in use = rows of that product."""

    __tablename__ = "product_assignments"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[int] = mapped_column(BigInteger)
    user_id: Mapped[int] = mapped_column(BigInteger)
    product_key: Mapped[str] = mapped_column(String(40))
    assigned_by: Mapped[int] = mapped_column(BigInteger)

    __table_args__ = (
        UniqueConstraint("organization_id", "user_id", "product_key", name="uq_product_assignments_person_product"),
        Index("ix_product_assignments_user", "user_id"),
    )


class PlatformOrder(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    __tablename__ = "platform_orders"

    public_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    owner_key: Mapped[str] = mapped_column(String(30), index=True)
    scope: Mapped[str] = mapped_column(String(14))
    buyer_user_id: Mapped[int] = mapped_column(BigInteger)
    idempotency_key: Mapped[str | None] = mapped_column(String(80))
    lines: Mapped[list[dict[str, Any]]] = mapped_column(JSONType, default=list)
    discount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    total: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    status: Mapped[str] = mapped_column(String(10))  # paid | failed
    failure_reason: Mapped[str | None] = mapped_column(String(200))

    __table_args__ = (UniqueConstraint("buyer_user_id", "idempotency_key", name="uq_platform_orders_buyer_key"),)
