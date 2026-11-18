"""Add student professional profiles and certifications.

Revision ID: 0014
Revises: 0013
Create Date: 2026-11-02 20:30:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0014"
down_revision: str | None = "0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    # 1. Add professional profiles to student_profiles
    if dialect == "sqlite":
        with op.batch_alter_table("student_profiles") as batch_op:
            batch_op.add_column(sa.Column("linkedin_url", sa.String(length=500), nullable=True))
            batch_op.add_column(sa.Column("github_url", sa.String(length=500), nullable=True))
            batch_op.add_column(sa.Column("hackerrank_url", sa.String(length=500), nullable=True))
            batch_op.add_column(sa.Column("leetcode_url", sa.String(length=500), nullable=True))
    else:
        op.add_column("student_profiles", sa.Column("linkedin_url", sa.String(length=500), nullable=True))
        op.add_column("student_profiles", sa.Column("github_url", sa.String(length=500), nullable=True))
        op.add_column("student_profiles", sa.Column("hackerrank_url", sa.String(length=500), nullable=True))
        op.add_column("student_profiles", sa.Column("leetcode_url", sa.String(length=500), nullable=True))

    # 2. Create student_certifications table
    op.create_table(
        "student_certifications",
        sa.Column("student_id", sa.Uuid(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("issuing_organization", sa.String(length=200), nullable=True),
        sa.Column("issue_date", sa.Date(), nullable=True),
        sa.Column("expiration_date", sa.Date(), nullable=True),
        sa.Column("credential_id", sa.String(length=100), nullable=True),
        sa.Column("credential_url", sa.String(length=500), nullable=True),
        sa.Column("document_url", sa.String(length=500), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["student_id"], ["users.id"], name=op.f("fk_student_certifications_student_id_users"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_student_certifications")),
    )
    op.create_index("ix_student_certifications_student_id", "student_certifications", ["student_id"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    op.drop_index("ix_student_certifications_student_id", table_name="student_certifications")
    op.drop_table("student_certifications")

    if dialect == "sqlite":
        with op.batch_alter_table("student_profiles") as batch_op:
            batch_op.drop_column("leetcode_url")
            batch_op.drop_column("hackerrank_url")
            batch_op.drop_column("github_url")
            batch_op.drop_column("linkedin_url")
    else:
        op.drop_column("student_profiles", "leetcode_url")
        op.drop_column("student_profiles", "hackerrank_url")
        op.drop_column("student_profiles", "github_url")
        op.drop_column("student_profiles", "linkedin_url")
