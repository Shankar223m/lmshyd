"""Assignable campus institutions for employer drives (multi-college visibility)."""

from alembic import op
import sqlalchemy as sa

revision = "005_job_target_institutions"
down_revision = "004_job_posting_channel"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("jobs", sa.Column("target_institution_ids", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("jobs", "target_institution_ids")