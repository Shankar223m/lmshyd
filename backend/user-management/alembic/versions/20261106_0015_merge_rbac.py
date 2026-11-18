"""merge the RBAC models migration with the profile and branding migrations

Revision ID: 0015
Revises: 0014, 20261101_0008_rbac_models
"""
from collections.abc import Sequence

revision: str = "0015"
down_revision: str | Sequence[str] | None = ("0014", "20261101_0008_rbac_models")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
