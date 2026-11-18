"""Industries, departments, job roles, career levels and resume purposes, and what a resume remembers about them.

Revision ID: d5e6f7a8b9c0
Revises: c4d5e6f7a8b9
Create Date: 2026-11-11 10:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "d5e6f7a8b9c0"
down_revision: str | None = "c4d5e6f7a8b9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

JSONT = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")


def _base() -> list[sa.Column]:
    return [
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    ]


def _profile() -> list[sa.Column]:
    return [
        sa.Column("skills", JSONT, nullable=False),
        sa.Column("keywords", JSONT, nullable=False),
        sa.Column("sections", JSONT, nullable=False),
        sa.Column("template_keys", JSONT, nullable=False),
        sa.Column("ai_hint", sa.Text()),
    ]


def upgrade() -> None:
    op.create_table(
        "industries", *_base(), sa.Column("key", sa.String(40), nullable=False, unique=True), sa.Column("name", sa.String(100), nullable=False),
        sa.Column("icon", sa.String(30), nullable=False), sa.Column("position", sa.Integer(), nullable=False), sa.Column("active", sa.Boolean(), nullable=False),
    )
    op.create_table(
        "departments", *_base(), sa.Column("industry_id", sa.Uuid(), sa.ForeignKey("industries.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("key", sa.String(60), nullable=False, unique=True), sa.Column("name", sa.String(100), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False), sa.Column("active", sa.Boolean(), nullable=False), *_profile(),
    )
    op.create_table(
        "job_roles", *_base(), sa.Column("department_id", sa.Uuid(), sa.ForeignKey("departments.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("key", sa.String(80), nullable=False, unique=True), sa.Column("name", sa.String(120), nullable=False),
        sa.Column("aliases", JSONT, nullable=False), sa.Column("specializations", JSONT, nullable=False), sa.Column("active", sa.Boolean(), nullable=False), *_profile(),
    )
    op.create_table(
        "career_levels", *_base(), sa.Column("key", sa.String(30), nullable=False, unique=True), sa.Column("name", sa.String(60), nullable=False),
        sa.Column("experience_level", sa.String(10), nullable=False), sa.Column("note", sa.String(200), nullable=False), sa.Column("position", sa.Integer(), nullable=False),
    )
    op.create_table(
        "resume_purposes", *_base(), sa.Column("key", sa.String(30), nullable=False, unique=True), sa.Column("name", sa.String(60), nullable=False),
        sa.Column("note", sa.String(200), nullable=False), sa.Column("emphasis", JSONT, nullable=False), sa.Column("position", sa.Integer(), nullable=False),
    )
    op.add_column("resumes", sa.Column("role_key", sa.String(80)))
    op.add_column("resumes", sa.Column("career_level", sa.String(30)))
    op.add_column("resumes", sa.Column("purpose", sa.String(30)))
    op.add_column("resumes", sa.Column("locale", JSONT, server_default="{}", nullable=False))


def downgrade() -> None:
    for column in ("locale", "purpose", "career_level", "role_key"):
        op.drop_column("resumes", column)
    for table in ("resume_purposes", "career_levels", "job_roles", "departments", "industries"):
        op.drop_table(table)
