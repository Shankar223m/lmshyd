"""Add custom_type to institutions table.

Revision ID: 0010
Revises: 0009
Create Date: 2026-10-24 17:15:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "t_0010"
down_revision: str | None = "t_0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("institutions", sa.Column("custom_type", sa.String(length=100), nullable=True))


def downgrade() -> None:
    op.drop_column("institutions", "custom_type")
