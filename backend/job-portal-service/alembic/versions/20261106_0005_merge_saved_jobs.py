"""merge the saved-jobs migration with the job description migrations

Revision ID: 0005_merge_saved_jobs
Revises: 0004_job_description_fields, 0003_saved_jobs
"""
from collections.abc import Sequence

revision: str = "0005_merge_saved_jobs"
down_revision: str | Sequence[str] | None = ("0004_job_description_fields", "0003_saved_jobs")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
