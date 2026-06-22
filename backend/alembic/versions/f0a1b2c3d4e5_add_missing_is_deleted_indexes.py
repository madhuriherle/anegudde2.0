"""add_missing_is_deleted_indexes

Revision ID: f0a1b2c3d4e5
Revises: e4f5a6b7c8d9
Create Date: 2026-06-22 19:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f0a1b2c3d4e5"
down_revision: Union[str, Sequence[str], None] = "e4f5a6b7c8d9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    tables = [
        "items", "menu_items", "vendors", "item_categories", "donation_types",
        "donation_amount_masters", "roles", "users", "units",
        "purchase_entries", "consumption_entries", "wastage_entries",
        "donation_entries", "purchase_return_entries",
    ]
    for table in tables:
        op.create_index(op.f(f"ix_{table}_is_deleted"), table, ["is_deleted"], unique=False)


def downgrade() -> None:
    tables = [
        "items", "menu_items", "vendors", "item_categories", "donation_types",
        "donation_amount_masters", "roles", "users", "units",
        "purchase_entries", "consumption_entries", "wastage_entries",
        "donation_entries", "purchase_return_entries",
    ]
    for table in tables:
        op.drop_index(op.f(f"ix_{table}_is_deleted"), table_name=table)
