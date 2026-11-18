"""JCMS workflow tables: recruiter assignments, interviews, placements, offer approval, reapply index

Revision ID: 0006_jcms_workflow
Revises: 0005_merge_saved_jobs
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0006_jcms_workflow"
down_revision: str | Sequence[str] | None = "0005_merge_saved_jobs"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "job_recruiter_assignments",
        sa.Column("job_id", sa.Uuid(), nullable=False),
        sa.Column("recruiter_user_id", sa.BigInteger(), nullable=False),
        sa.Column("assigned_by", sa.BigInteger(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"], name=op.f("fk_job_recruiter_assignments_job_id_jobs"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_job_recruiter_assignments")),
        sa.UniqueConstraint("job_id", "recruiter_user_id", name="uq_job_recruiter_assignments_job_user"),
    )
    op.create_index("ix_job_recruiter_assignments_recruiter", "job_recruiter_assignments", ["recruiter_user_id"])
    op.create_index("ix_job_recruiter_assignments_job", "job_recruiter_assignments", ["job_id"])

    op.create_table(
        "interviews",
        sa.Column("public_id", sa.BigInteger(), nullable=False),
        sa.Column("application_id", sa.Uuid(), nullable=False),
        sa.Column("job_id", sa.Uuid(), nullable=False),
        sa.Column("employer_org_id", sa.BigInteger(), nullable=False),
        sa.Column("student_user_id", sa.BigInteger(), nullable=False),
        sa.Column("round_name", sa.String(length=100), nullable=False),
        sa.Column("format", sa.String(length=20), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("timezone", sa.String(length=64), nullable=False),
        sa.Column("meeting_link", sa.String(length=500), nullable=True),
        sa.Column("instructions", sa.Text(), nullable=True),
        sa.Column("panel_user_ids", sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql"), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("outcome", sa.String(length=100), nullable=True),
        sa.Column("created_by", sa.BigInteger(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["application_id"], ["applications.id"], name=op.f("fk_interviews_application_id_applications"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"], name=op.f("fk_interviews_job_id_jobs"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_interviews")),
        sa.UniqueConstraint("public_id", name=op.f("uq_interviews_public_id")),
    )
    op.create_index("ix_interviews_application", "interviews", ["application_id", "starts_at"])
    op.create_index("ix_interviews_student", "interviews", ["student_user_id", "starts_at"])
    op.create_index("ix_interviews_employer", "interviews", ["employer_org_id", "status"])
    op.create_index("ix_interviews_job", "interviews", ["job_id"])

    op.create_table(
        "interview_scorecards",
        sa.Column("interview_id", sa.Uuid(), nullable=False),
        sa.Column("technical_skills", sa.Integer(), nullable=True),
        sa.Column("problem_solving", sa.Integer(), nullable=True),
        sa.Column("communication", sa.Integer(), nullable=True),
        sa.Column("culture_fit", sa.Integer(), nullable=True),
        sa.Column("comments", sa.Text(), nullable=True),
        sa.Column("recommendation", sa.String(length=40), nullable=True),
        sa.Column("submitted_by", sa.BigInteger(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["interview_id"], ["interviews.id"], name=op.f("fk_interview_scorecards_interview_id_interviews"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_interview_scorecards")),
        sa.UniqueConstraint("interview_id", name=op.f("uq_interview_scorecards_interview_id")),
    )

    op.create_table(
        "interview_reschedule_requests",
        sa.Column("public_id", sa.BigInteger(), nullable=False),
        sa.Column("interview_id", sa.Uuid(), nullable=False),
        sa.Column("student_user_id", sa.BigInteger(), nullable=False),
        sa.Column("requested_starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("requested_ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("reviewer_user_id", sa.BigInteger(), nullable=True),
        sa.Column("reviewer_comment", sa.Text(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["interview_id"], ["interviews.id"], name=op.f("fk_interview_reschedule_requests_interview_id_interviews"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_interview_reschedule_requests")),
        sa.UniqueConstraint("public_id", name="uq_interview_reschedule_requests_public_id"),
    )
    op.create_index("ix_interview_reschedule_interview", "interview_reschedule_requests", ["interview_id", "status"])

    op.add_column("offers", sa.Column("location", sa.String(length=160), nullable=True))
    op.add_column("offers", sa.Column("requires_approval", sa.Boolean(), server_default=sa.text("false"), nullable=False))
    op.add_column("offers", sa.Column("approved_by", sa.BigInteger(), nullable=True))
    op.add_column("offers", sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("offers", sa.Column("offer_letter_media_id", sa.BigInteger(), nullable=True))
    op.add_column("offers", sa.Column("version", sa.Integer(), server_default=sa.text("1"), nullable=False))
    op.alter_column("offers", "status", existing_type=sa.String(length=10), type_=sa.String(length=20), existing_nullable=False)

    op.create_table(
        "placements",
        sa.Column("public_id", sa.BigInteger(), nullable=False),
        sa.Column("application_id", sa.Uuid(), nullable=False),
        sa.Column("offer_id", sa.Uuid(), nullable=False),
        sa.Column("student_user_id", sa.BigInteger(), nullable=False),
        sa.Column("institution_id", sa.BigInteger(), nullable=True),
        sa.Column("employer_org_id", sa.BigInteger(), nullable=False),
        sa.Column("job_id", sa.Uuid(), nullable=False),
        sa.Column("designation", sa.String(length=160), nullable=True),
        sa.Column("joining_date", sa.Date(), nullable=True),
        sa.Column("annual_package", sa.BigInteger(), nullable=True),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("work_location", sa.String(length=160), nullable=True),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("verifier_comment", sa.Text(), nullable=True),
        sa.Column("verified_by", sa.BigInteger(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["application_id"], ["applications.id"], name=op.f("fk_placements_application_id_applications"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["offer_id"], ["offers.id"], name=op.f("fk_placements_offer_id_offers"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"], name=op.f("fk_placements_job_id_jobs"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_placements")),
        sa.UniqueConstraint("application_id", name=op.f("uq_placements_application_id")),
        sa.UniqueConstraint("public_id", name=op.f("uq_placements_public_id")),
    )
    op.create_index("ix_placements_student", "placements", ["student_user_id", "status"])
    op.create_index("ix_placements_institution", "placements", ["institution_id", "status"])
    op.create_index("ix_placements_employer", "placements", ["employer_org_id", "status"])

    op.create_table(
        "placement_evidence",
        sa.Column("public_id", sa.BigInteger(), nullable=False),
        sa.Column("placement_id", sa.Uuid(), nullable=False),
        sa.Column("media_asset_id", sa.BigInteger(), nullable=False),
        sa.Column("category", sa.String(length=40), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column("reviewed_by", sa.BigInteger(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["placement_id"], ["placements.id"], name=op.f("fk_placement_evidence_placement_id_placements"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_placement_evidence")),
        sa.UniqueConstraint("public_id", name="uq_placement_evidence_public_id"),
    )
    op.create_index("ix_placement_evidence_placement", "placement_evidence", ["placement_id", "status"])

    # Allow reapply after withdrawal: drop hard unique, add partial unique excluding withdrawn.
    op.drop_constraint("uq_applications_job_user", "applications", type_="unique")
    op.execute(
        """
        CREATE UNIQUE INDEX uq_applications_job_user_active
        ON applications (job_id, user_id)
        WHERE status <> 'withdrawn'
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_applications_job_user_active")
    op.create_unique_constraint("uq_applications_job_user", "applications", ["job_id", "user_id"])

    op.drop_index("ix_placement_evidence_placement", table_name="placement_evidence")
    op.drop_table("placement_evidence")
    op.drop_index("ix_placements_employer", table_name="placements")
    op.drop_index("ix_placements_institution", table_name="placements")
    op.drop_index("ix_placements_student", table_name="placements")
    op.drop_table("placements")

    op.drop_column("offers", "version")
    op.drop_column("offers", "offer_letter_media_id")
    op.drop_column("offers", "approved_at")
    op.drop_column("offers", "approved_by")
    op.drop_column("offers", "requires_approval")
    op.drop_column("offers", "location")
    op.alter_column("offers", "status", existing_type=sa.String(length=20), type_=sa.String(length=10), existing_nullable=False)

    op.drop_index("ix_interview_reschedule_interview", table_name="interview_reschedule_requests")
    op.drop_table("interview_reschedule_requests")
    op.drop_table("interview_scorecards")
    op.drop_index("ix_interviews_job", table_name="interviews")
    op.drop_index("ix_interviews_employer", table_name="interviews")
    op.drop_index("ix_interviews_student", table_name="interviews")
    op.drop_index("ix_interviews_application", table_name="interviews")
    op.drop_table("interviews")
    op.drop_index("ix_job_recruiter_assignments_job", table_name="job_recruiter_assignments")
    op.drop_index("ix_job_recruiter_assignments_recruiter", table_name="job_recruiter_assignments")
    op.drop_table("job_recruiter_assignments")
