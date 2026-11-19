"""Job posting channel (campus vs open market) and student discover flags."""

from alembic import op
import sqlalchemy as sa

revision = "004_job_posting_channel"
down_revision = "003_application_reapply_unique"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "jobs",
        sa.Column("posting_channel", sa.String(length=20), nullable=False, server_default="OPEN"),
    )
    op.add_column(
        "jobs",
        sa.Column("campus_institution_id", sa.String(length=36), sa.ForeignKey("organizations.id"), nullable=True),
    )
    op.create_index("ix_jobs_posting_channel", "jobs", ["posting_channel"])
    op.create_index("ix_jobs_campus_institution_id", "jobs", ["campus_institution_id"])
    op.add_column(
        "student_profiles",
        sa.Column("open_market_only", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("student_profiles", "open_market_only")
    op.drop_index("ix_jobs_campus_institution_id", table_name="jobs")
    op.drop_index("ix_jobs_posting_channel", table_name="jobs")
    op.drop_column("jobs", "campus_institution_id")
    op.drop_column("jobs", "posting_channel")