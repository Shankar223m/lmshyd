"""Saved jobs: a student's private bookmarks.

Revision ID: 0003_saved_jobs
Revises: 0002_internship_stipend
Create Date: 2026-11-01 15:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0003_saved_jobs"
down_revision: str | None = "0002_internship_stipend"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "saved_jobs",
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("job_id", sa.Uuid(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"], name=op.f("fk_saved_jobs_job_id_jobs"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_saved_jobs")),
        sa.UniqueConstraint("user_id", "job_id", name="uq_saved_jobs_user_job"),
    )
    op.create_index("ix_saved_jobs_user", "saved_jobs", ["user_id", "created_at"])


def downgrade() -> None:
    op.drop_table("saved_jobs")
