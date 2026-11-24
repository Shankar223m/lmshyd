"""course level, duration, pass (legacy local revision — DB may already have columns)

Revision ID: d1e2f3a4b5c6
Revises: a89b972f38a3
Create Date: 2026-11-01
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "d1e2f3a4b5c6"
down_revision: str | None = "a89b972f38a3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    cols = {c["name"] for c in insp.get_columns("courses")}
    if "level" not in cols:
        op.add_column(
            "courses",
            sa.Column("level", sa.String(length=14), nullable=False, server_default="beginner"),
        )
    if "duration_hours" not in cols:
        op.add_column("courses", sa.Column("duration_hours", sa.Integer(), nullable=True))
    if "pass_percent" not in cols:
        op.add_column(
            "courses",
            sa.Column("pass_percent", sa.Integer(), nullable=False, server_default="60"),
        )


def downgrade() -> None:
    op.drop_column("courses", "pass_percent")
    op.drop_column("courses", "duration_hours")
    op.drop_column("courses", "level")