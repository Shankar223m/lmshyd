"""add class_section_id to batches

Revision ID: c1f9d8a2b34e
Revises: b006d747a3db
Create Date: 2026-10-24 12:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = 'c1f9d8a2b34e'
down_revision: str | None = 'b006d747a3db'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column('batches', sa.Column('class_section_id', sa.BigInteger(), nullable=True))
    op.create_index(op.f('ix_batches_class_section_id'), 'batches', ['class_section_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_batches_class_section_id'), table_name='batches')
    op.drop_column('batches', 'class_section_id')
