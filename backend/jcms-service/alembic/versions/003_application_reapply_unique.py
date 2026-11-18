"""Allow reapplication after withdrawal by relaxing unique constraint.

Revision ID: 003
Revises: 002
"""

from alembic import op
from sqlalchemy import text

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name
    # Drop legacy unique (job_id, student_id) so withdrawn apps can coexist with a new apply.
    if dialect == "postgresql":
        # Constraint name varies by how 001 created it; drop any matching unique on (job_id, student_id).
        rows = bind.execute(
            text(
                """
                SELECT c.conname
                FROM pg_constraint c
                JOIN pg_class t ON c.conrelid = t.oid
                WHERE t.relname = 'applications'
                  AND c.contype = 'u'
                  AND pg_get_constraintdef(c.oid) ILIKE '%job_id%student_id%'
                """
            )
        ).fetchall()
        for (name,) in rows:
            bind.execute(text(f'ALTER TABLE applications DROP CONSTRAINT IF EXISTS "{name}"'))
        op.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS uq_active_job_student_application
            ON applications (job_id, student_id)
            WHERE status <> 'WITHDRAWN'
            """
        )
    else:
        with op.batch_alter_table("applications") as batch:
            try:
                batch.drop_constraint("uq_job_student_application", type_="unique")
            except Exception:
                pass


def downgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name
    if dialect == "postgresql":
        op.execute("DROP INDEX IF EXISTS uq_active_job_student_application")
        op.execute(
            """
            ALTER TABLE applications
            ADD CONSTRAINT uq_job_student_application UNIQUE (job_id, student_id)
            """
        )
    else:
        with op.batch_alter_table("applications") as batch:
            batch.create_unique_constraint("uq_job_student_application", ["job_id", "student_id"])
