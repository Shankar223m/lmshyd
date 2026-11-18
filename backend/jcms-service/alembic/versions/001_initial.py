"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-11-03
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Tables created via metadata for greenfield bootstrap
    from app.core.database import Base
    from app.models import entities  # noqa: F401

    bind = op.get_bind()
    Base.metadata.create_all(bind)


def downgrade() -> None:
    from app.core.database import Base
    from app.models import entities  # noqa: F401

    bind = op.get_bind()
    Base.metadata.drop_all(bind)
