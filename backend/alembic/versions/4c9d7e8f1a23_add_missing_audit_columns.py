"""add_missing_audit_columns

Revision ID: 4c9d7e8f1a23
Revises: f198286615fd
Create Date: 2026-05-21 02:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "4c9d7e8f1a23"
down_revision: Union[str, Sequence[str], None] = "f198286615fd"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return column_name in {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    if not _has_column("financial_years", "updated_by"):
        op.add_column("financial_years", sa.Column("updated_by", sa.Integer(), nullable=True))
        op.create_foreign_key(
            "fk_financial_years_updated_by_users",
            "financial_years",
            "users",
            ["updated_by"],
            ["id"],
        )

    if not _has_column("system_settings", "created_at"):
        op.add_column(
            "system_settings",
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        )

    if not _has_column("system_settings", "created_by"):
        op.add_column("system_settings", sa.Column("created_by", sa.Integer(), nullable=True))
        op.create_foreign_key(
            "fk_system_settings_created_by_users",
            "system_settings",
            "users",
            ["created_by"],
            ["id"],
        )


def downgrade() -> None:
    if _has_column("system_settings", "created_by"):
        op.drop_constraint("fk_system_settings_created_by_users", "system_settings", type_="foreignkey")
        op.drop_column("system_settings", "created_by")

    if _has_column("system_settings", "created_at"):
        op.drop_column("system_settings", "created_at")

    if _has_column("financial_years", "updated_by"):
        op.drop_constraint("fk_financial_years_updated_by_users", "financial_years", type_="foreignkey")
        op.drop_column("financial_years", "updated_by")
