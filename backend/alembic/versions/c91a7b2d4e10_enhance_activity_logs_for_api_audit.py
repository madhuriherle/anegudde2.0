"""enhance activity_logs for api audit

Revision ID: c91a7b2d4e10
Revises: b34d9e2c4f11
Create Date: 2026-05-06 16:20:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "c91a7b2d4e10"
down_revision = "b34d9e2c4f11"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("activity_logs", sa.Column("route_template", sa.String(length=255), nullable=True))
    op.add_column("activity_logs", sa.Column("duration_ms", sa.Integer(), nullable=True))
    op.add_column("activity_logs", sa.Column("error_code", sa.String(length=64), nullable=True))
    op.add_column(
        "activity_logs",
        sa.Column(
            "meta",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )

    op.execute(
        """
        UPDATE activity_logs
        SET route_template = endpoint
        WHERE route_template IS NULL
        """
    )

    op.create_check_constraint(
        "chk_activity_duration_non_negative",
        "activity_logs",
        "duration_ms IS NULL OR duration_ms >= 0",
    )

    op.create_index(
        "idx_activity_logs_user_id_activity_at",
        "activity_logs",
        ["user_id", "activity_at"],
        unique=False,
        postgresql_using="btree",
    )
    op.create_index(
        "idx_activity_logs_status_activity_at",
        "activity_logs",
        ["activity_status", "activity_at"],
        unique=False,
        postgresql_using="btree",
    )
    op.create_index(
        "idx_activity_logs_route_template_activity_at",
        "activity_logs",
        ["route_template", "activity_at"],
        unique=False,
        postgresql_using="btree",
    )
    op.create_index(
        "idx_activity_logs_meta_gin",
        "activity_logs",
        ["meta"],
        unique=False,
        postgresql_using="gin",
    )


def downgrade() -> None:
    op.drop_index("idx_activity_logs_meta_gin", table_name="activity_logs")
    op.drop_index("idx_activity_logs_route_template_activity_at", table_name="activity_logs")
    op.drop_index("idx_activity_logs_status_activity_at", table_name="activity_logs")
    op.drop_index("idx_activity_logs_user_id_activity_at", table_name="activity_logs")
    op.drop_constraint("chk_activity_duration_non_negative", "activity_logs", type_="check")

    op.drop_column("activity_logs", "meta")
    op.drop_column("activity_logs", "error_code")
    op.drop_column("activity_logs", "duration_ms")
    op.drop_column("activity_logs", "route_template")
