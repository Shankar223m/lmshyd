"""Organization requests: organizations asking for a workspace, reviewed by a super admin.

Revision ID: 0012
Revises: t_0011
Create Date: 2026-11-01 11:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0012"
down_revision: str | None = "t_0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "organization_requests",
        sa.Column("public_id", sa.BigInteger(), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("org_type", sa.String(60), nullable=False),
        sa.Column("official_email", sa.String(254), nullable=False),
        sa.Column("phone", sa.String(30), nullable=False),
        sa.Column("website", sa.String(300), nullable=True),
        sa.Column("country", sa.String(80), nullable=False),
        sa.Column("state", sa.String(80), nullable=False),
        sa.Column("city", sa.String(80), nullable=False),
        sa.Column("address", sa.String(300), nullable=False),
        sa.Column("size", sa.String(20), nullable=False),
        sa.Column("owner_name", sa.String(120), nullable=False),
        sa.Column("owner_email", sa.String(254), nullable=False),
        sa.Column("owner_phone", sa.String(30), nullable=False),
        sa.Column("owner_designation", sa.String(80), nullable=False),
        sa.Column("status", sa.String(10), server_default="pending", nullable=False),
        sa.Column("decision_note", sa.String(500), nullable=True),
        sa.Column("decided_by", sa.BigInteger(), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("request_ip", sa.String(45), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_organization_requests")),
        sa.UniqueConstraint("public_id", name=op.f("uq_organization_requests_public_id")),
    )
    op.create_index("ix_organization_requests_status_created", "organization_requests", ["status", "created_at"])
    op.create_index("ix_organization_requests_owner_email", "organization_requests", ["owner_email"])


def downgrade() -> None:
    op.drop_table("organization_requests")
