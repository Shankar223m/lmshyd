"""Add RBAC tables for permission overrides and admin delegation.

Revision ID: 20261101_0008_rbac_models
Revises: 0007
Create Date: 2026-11-01 00:00:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "20261101_0008_rbac_models"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- permission effect enum (allow/deny) ---
    effect_enum = postgresql.ENUM("allow", "deny", name="permissioneffect", create_type=False)
    effect_enum.create(op.get_bind(), checkfirst=True)

    # --- user_permission_overrides table ---
    op.create_table(
        "user_permission_overrides",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", sa.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("permission_key", sa.String(length=128), nullable=False),
        sa.Column("effect", effect_enum, nullable=False),
        sa.Column("created_by_id", sa.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("updated_by_id", sa.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.text("CURRENT_TIMESTAMP"), nullable=True),
        sa.UniqueConstraint("user_id", "permission_key", name="uq_user_permission"),
    )

    # --- admin_delegations table ---
    op.create_table(
        "admin_delegations",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("admin_user_id", sa.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("is_enabled", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("can_manage_individual_permissions", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("can_manage_role_templates", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("can_manage_institution_access", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("can_reset_individual_overrides", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("created_by_id", sa.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("updated_by_id", sa.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.text("CURRENT_TIMESTAMP"), nullable=True),
        sa.UniqueConstraint("admin_user_id", name="uq_admin_delegation"),
        sa.Index("ix_admin_delegations_user", "admin_user_id"),
    )

    # --- delegation_institutions linking table ---
    op.create_table(
        "delegation_institutions",
        sa.Column("delegation_id", sa.UUID(as_uuid=True), sa.ForeignKey("admin_delegations.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("institution_id", sa.UUID(as_uuid=True), sa.ForeignKey("institutions.id", ondelete="CASCADE"), primary_key=True),
        sa.UniqueConstraint("delegation_id", "institution_id", name="uq_delegation_institution"),
    )


def downgrade() -> None:
    op.drop_table("delegation_institutions")
    op.drop_table("admin_delegations")
    op.drop_table("user_permission_overrides")
    # Drop the enum type
    effect_enum = postgresql.ENUM(name="permissioneffect")
    effect_enum.drop(op.get_bind(), checkfirst=True)
