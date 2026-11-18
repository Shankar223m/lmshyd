"""A resume's own look (accent colour, font family, text size, spacing) on top of its template.

Revision ID: c4d5e6f7a8b9
Revises: b3c1d2e4f5a6
Create Date: 2026-11-01 12:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "c4d5e6f7a8b9"
down_revision: str | None = "b3c1d2e4f5a6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("resumes", sa.Column("style", sa.JSON().with_variant(postgresql.JSONB(), "postgresql"), server_default="{}", nullable=False))


def downgrade() -> None:
    op.drop_column("resumes", "style")
