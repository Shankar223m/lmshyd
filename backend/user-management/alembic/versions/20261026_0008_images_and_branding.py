"""Profile photos, organisation logos and brand colours.

Revision ID: 0008
Revises: 0007
Create Date: 2026-10-26 12:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "stored_images",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("owner_kind", sa.String(length=16), nullable=False),
        sa.Column("owner_public_id", sa.BigInteger(), nullable=False),
        sa.Column("content_type", sa.String(length=32), nullable=False),
        sa.Column("data", sa.LargeBinary(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_stored_images")),
        sa.UniqueConstraint("owner_kind", "owner_public_id", name="uq_stored_images_owner"),
    )
    op.add_column("users", sa.Column("image_version", sa.Integer(), server_default="0", nullable=False))
    op.add_column("institutions", sa.Column("brand_color", sa.String(length=7), nullable=True))
    op.add_column("institutions", sa.Column("image_version", sa.Integer(), server_default="0", nullable=False))


def downgrade() -> None:
    op.drop_column("institutions", "image_version")
    op.drop_column("institutions", "brand_color")
    op.drop_column("users", "image_version")
    op.drop_table("stored_images")
