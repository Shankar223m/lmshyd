"""Marketplace: catalogue, per-product subscriptions, assignments and orders.

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-11-01 10:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "d4e5f6a7b8c9"
down_revision: str | None = "c3d4e5f6a7b8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

JSON = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")
NOW = sa.text("now()")


def _stamps() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
    ]


def upgrade() -> None:
    op.create_table(
        "catalog_products",
        sa.Column("key", sa.String(40), nullable=False),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("icon", sa.String(30), server_default="sparkles", nullable=False),
        sa.Column("tagline", sa.String(160), nullable=False),
        sa.Column("description", sa.String(1000), nullable=False),
        sa.Column("features", JSON, nullable=False),
        sa.Column("modules", JSON, nullable=False),
        sa.Column("position", sa.Integer(), server_default="0", nullable=False),
        sa.Column("active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        *_stamps(),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_catalog_products")),
        sa.UniqueConstraint("key", name=op.f("uq_catalog_products_key")),
    )
    op.create_table(
        "catalog_plans",
        sa.Column("product_id", sa.Uuid(), nullable=False),
        sa.Column("key", sa.String(40), nullable=False),
        sa.Column("name", sa.String(60), nullable=False),
        sa.Column("monthly_price", sa.Numeric(10, 2), nullable=False),
        sa.Column("seat_price", sa.Numeric(10, 2), server_default="0", nullable=False),
        sa.Column("limits", JSON, nullable=False),
        sa.Column("highlight", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        *_stamps(),
        sa.ForeignKeyConstraint(["product_id"], ["catalog_products.id"], name=op.f("fk_catalog_plans_product_id_catalog_products"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_catalog_plans")),
        sa.UniqueConstraint("product_id", "key", name="uq_catalog_plans_product_key"),
    )
    op.create_table(
        "product_subscriptions",
        sa.Column("public_id", sa.BigInteger(), nullable=False),
        sa.Column("owner_key", sa.String(30), nullable=False),
        sa.Column("scope", sa.String(14), nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=True),
        sa.Column("organization_id", sa.BigInteger(), nullable=True),
        sa.Column("product_key", sa.String(40), nullable=False),
        sa.Column("plan_key", sa.String(40), nullable=False),
        sa.Column("seats", sa.Integer(), server_default="1", nullable=False),
        sa.Column("module_keys", JSON, nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        *_stamps(),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_product_subscriptions")),
        sa.UniqueConstraint("owner_key", "product_key", name="uq_product_subscriptions_owner_product"),
    )
    op.create_index(op.f("ix_product_subscriptions_public_id"), "product_subscriptions", ["public_id"], unique=True)
    op.create_index("ix_product_subscriptions_org", "product_subscriptions", ["organization_id"])
    op.create_index("ix_product_subscriptions_user", "product_subscriptions", ["user_id"])
    op.create_table(
        "product_assignments",
        sa.Column("organization_id", sa.BigInteger(), nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("product_key", sa.String(40), nullable=False),
        sa.Column("assigned_by", sa.BigInteger(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_product_assignments")),
        sa.UniqueConstraint("organization_id", "user_id", "product_key", name="uq_product_assignments_person_product"),
    )
    op.create_index("ix_product_assignments_user", "product_assignments", ["user_id"])
    op.create_table(
        "platform_orders",
        sa.Column("public_id", sa.BigInteger(), nullable=False),
        sa.Column("owner_key", sa.String(30), nullable=False),
        sa.Column("scope", sa.String(14), nullable=False),
        sa.Column("buyer_user_id", sa.BigInteger(), nullable=False),
        sa.Column("idempotency_key", sa.String(80), nullable=True),
        sa.Column("lines", JSON, nullable=False),
        sa.Column("discount", sa.Numeric(10, 2), nullable=False),
        sa.Column("total", sa.Numeric(10, 2), nullable=False),
        sa.Column("status", sa.String(10), nullable=False),
        sa.Column("failure_reason", sa.String(200), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_platform_orders")),
        sa.UniqueConstraint("buyer_user_id", "idempotency_key", name="uq_platform_orders_buyer_key"),
    )
    op.create_index(op.f("ix_platform_orders_public_id"), "platform_orders", ["public_id"], unique=True)
    op.create_index(op.f("ix_platform_orders_owner_key"), "platform_orders", ["owner_key"])


def downgrade() -> None:
    op.drop_table("platform_orders")
    op.drop_table("product_assignments")
    op.drop_table("product_subscriptions")
    op.drop_table("catalog_plans")
    op.drop_table("catalog_products")
