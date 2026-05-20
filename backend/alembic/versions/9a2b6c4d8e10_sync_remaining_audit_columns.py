"""sync_remaining_audit_columns

Revision ID: 9a2b6c4d8e10
Revises: 4c9d7e8f1a23
Create Date: 2026-05-21 02:25:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9a2b6c4d8e10"
down_revision: Union[str, Sequence[str], None] = "4c9d7e8f1a23"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


AUDIT_COLUMNS: dict[str, tuple[str, ...]] = {
    "receipt_sequences": ("created_by", "updated_by"),
    "item_serial_numbers": ("created_by", "updated_at", "updated_by"),
    "item_prices": ("updated_at", "updated_by"),
    "purchase_bills": ("created_by", "updated_at", "updated_by"),
    "stock_adjustments": ("updated_at", "updated_by"),
    "donation_items": ("created_by", "updated_at", "updated_by"),
    "login_history": ("created_by", "updated_at", "updated_by"),
    "daily_stock_summary": ("created_by", "updated_by"),
    "monthly_stock_summary": ("created_by", "updated_by"),
    "purchase_return_items": ("created_by", "updated_at", "updated_by"),
}


def _has_column(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return column_name in {column["name"] for column in inspector.get_columns(table_name)}


def _fk_name(table_name: str, column_name: str) -> str:
    return f"fk_{table_name}_{column_name}_users"


def _add_audit_column(table_name: str, column_name: str) -> None:
    if _has_column(table_name, column_name):
        return

    if column_name == "updated_at":
        op.add_column(
            table_name,
            sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        )
        return

    op.add_column(table_name, sa.Column(column_name, sa.Integer(), nullable=True))
    op.create_foreign_key(
        _fk_name(table_name, column_name),
        table_name,
        "users",
        [column_name],
        ["id"],
    )


def upgrade() -> None:
    for table_name, column_names in AUDIT_COLUMNS.items():
        for column_name in column_names:
            _add_audit_column(table_name, column_name)


def downgrade() -> None:
    for table_name, column_names in reversed(AUDIT_COLUMNS.items()):
        for column_name in reversed(column_names):
            if not _has_column(table_name, column_name):
                continue
            if column_name != "updated_at":
                op.drop_constraint(_fk_name(table_name, column_name), table_name, type_="foreignkey")
            op.drop_column(table_name, column_name)
