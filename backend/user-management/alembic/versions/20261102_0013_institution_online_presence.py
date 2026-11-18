"""Add online presence and social media URLs to institutions.

Revision ID: 0013
Revises: 0012
Create Date: 2026-11-02 12:30:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0013"
down_revision: str | None = "0012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "sqlite":
        with op.batch_alter_table("institutions") as batch_op:
            batch_op.add_column(sa.Column("linkedin_url", sa.String(length=500), nullable=True))
            batch_op.add_column(sa.Column("instagram_url", sa.String(length=500), nullable=True))
            batch_op.add_column(sa.Column("facebook_url", sa.String(length=500), nullable=True))
            batch_op.add_column(sa.Column("youtube_url", sa.String(length=500), nullable=True))
            batch_op.add_column(sa.Column("twitter_url", sa.String(length=500), nullable=True))
            batch_op.alter_column("website", type_=sa.String(length=500), existing_type=sa.String(length=255), existing_nullable=True)
    else:
        op.add_column("institutions", sa.Column("linkedin_url", sa.String(length=500), nullable=True))
        op.add_column("institutions", sa.Column("instagram_url", sa.String(length=500), nullable=True))
        op.add_column("institutions", sa.Column("facebook_url", sa.String(length=500), nullable=True))
        op.add_column("institutions", sa.Column("youtube_url", sa.String(length=500), nullable=True))
        op.add_column("institutions", sa.Column("twitter_url", sa.String(length=500), nullable=True))
        op.alter_column("institutions", "website", type_=sa.String(length=500), existing_type=sa.String(length=255), existing_nullable=True)


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "sqlite":
        with op.batch_alter_table("institutions") as batch_op:
            batch_op.drop_column("twitter_url")
            batch_op.drop_column("youtube_url")
            batch_op.drop_column("facebook_url")
            batch_op.drop_column("instagram_url")
            batch_op.drop_column("linkedin_url")
            batch_op.alter_column("website", type_=sa.String(length=255), existing_type=sa.String(length=500), existing_nullable=True)
    else:
        op.drop_column("institutions", "twitter_url")
        op.drop_column("institutions", "youtube_url")
        op.drop_column("facebook_url")
        op.drop_column("institutions", "instagram_url")
        op.drop_column("institutions", "linkedin_url")
        op.alter_column("institutions", "website", type_=sa.String(length=255), existing_type=sa.String(length=500), existing_nullable=True)
