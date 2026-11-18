"""Add logo_url to institutions table for profile picture / logo support.

Revision ID: 0009
Revises: 0008
Create Date: 2026-10-24 12:30:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "t_0009"
down_revision: str | None = "t_0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("institutions", sa.Column("logo_url", sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column("institutions", "logo_url")
