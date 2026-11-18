"""Increase custom_type length to 500 characters.

Revision ID: 0011
Revises: 0010
Create Date: 2026-10-24 21:45:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "t_0011"
down_revision: str | None = "t_0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "institutions",
        "custom_type",
        type_=sa.String(length=500),
        existing_type=sa.String(length=100),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "institutions",
        "custom_type",
        type_=sa.String(length=100),
        existing_type=sa.String(length=500),
        existing_nullable=True,
    )
