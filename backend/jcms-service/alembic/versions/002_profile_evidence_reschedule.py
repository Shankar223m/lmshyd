"""Add profile, placement evidence, and interview reschedule tables.

Revision ID: 002
Revises: 001
"""

from alembic import op
import sqlalchemy as sa

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def _has_column(inspector, table: str, column: str) -> bool:
    return column in {c["name"] for c in inspector.get_columns(table)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    org_cols = [
        ("description", sa.Text()),
        ("industry", sa.String(255)),
        ("address", sa.Text()),
        ("placement_contact_name", sa.String(255)),
        ("placement_contact_email", sa.String(255)),
    ]
    for name, coltype in org_cols:
        if not _has_column(inspector, "organizations", name):
            op.add_column("organizations", sa.Column(name, coltype, nullable=True))

    sp_cols = [
        ("department", sa.String(255)),
        ("batch", sa.String(100)),
        ("phone", sa.String(50)),
        ("projects", sa.JSON()),
        ("certifications", sa.JSON()),
        ("experience", sa.JSON()),
    ]
    for name, coltype in sp_cols:
        if not _has_column(inspector, "student_profiles", name):
            op.add_column("student_profiles", sa.Column(name, coltype, nullable=True))

    if not inspector.has_table("interview_reschedule_requests"):
        op.create_table(
            "interview_reschedule_requests",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("interview_id", sa.String(36), sa.ForeignKey("interviews.id"), nullable=False),
            sa.Column("student_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("requested_starts_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("requested_ends_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("reason", sa.Text(), nullable=True),
            sa.Column("status", sa.String(50), nullable=False, server_default="PENDING"),
            sa.Column("reviewer_id", sa.String(36), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("reviewer_comment", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        )
        op.create_index("ix_interview_reschedule_interview", "interview_reschedule_requests", ["interview_id"])

    if not inspector.has_table("placement_evidence"):
        op.create_table(
            "placement_evidence",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("placement_id", sa.String(36), sa.ForeignKey("placements.id"), nullable=False),
            sa.Column("file_id", sa.String(36), sa.ForeignKey("files.id"), nullable=False),
            sa.Column("category", sa.String(100), nullable=False),
            sa.Column("status", sa.String(50), nullable=False, server_default="PENDING"),
            sa.Column("rejection_reason", sa.Text(), nullable=True),
            sa.Column("reviewed_by", sa.String(36), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        )
        op.create_index("ix_placement_evidence_placement", "placement_evidence", ["placement_id"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table("placement_evidence"):
        op.drop_index("ix_placement_evidence_placement", table_name="placement_evidence")
        op.drop_table("placement_evidence")
    if inspector.has_table("interview_reschedule_requests"):
        op.drop_index("ix_interview_reschedule_interview", table_name="interview_reschedule_requests")
        op.drop_table("interview_reschedule_requests")
    for col in ("experience", "certifications", "projects", "phone", "batch", "department"):
        if _has_column(inspector, "student_profiles", col):
            op.drop_column("student_profiles", col)
    for col in (
        "placement_contact_email",
        "placement_contact_name",
        "address",
        "industry",
        "description",
    ):
        if _has_column(inspector, "organizations", col):
            op.drop_column("organizations", col)
