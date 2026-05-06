"""add activity_logs table

Revision ID: a12f4a7b9c01
Revises: 5382328a5307
Create Date: 2026-05-06 16:05:00
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "a12f4a7b9c01"
down_revision = "5382328a5307"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "activity_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("activity_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("method", sa.String(length=10), nullable=False),
        sa.Column("endpoint", sa.String(length=255), nullable=False),
        sa.Column("action", sa.String(length=150), nullable=False),
        sa.Column("activity_status", sa.String(length=20), nullable=False),
        sa.Column("reason", sa.String(length=255), nullable=True),
        sa.Column("http_status_code", sa.Integer(), nullable=True),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("request_id", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("updated_by", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_activity_logs_user_id", "activity_logs", ["user_id"], unique=False)
    op.create_index("ix_activity_logs_activity_at", "activity_logs", ["activity_at"], unique=False)
    op.create_index("ix_activity_logs_endpoint", "activity_logs", ["endpoint"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_activity_logs_endpoint", table_name="activity_logs")
    op.drop_index("ix_activity_logs_activity_at", table_name="activity_logs")
    op.drop_index("ix_activity_logs_user_id", table_name="activity_logs")
    op.drop_table("activity_logs")
