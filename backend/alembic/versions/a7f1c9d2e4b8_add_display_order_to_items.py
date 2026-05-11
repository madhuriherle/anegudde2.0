"""add display_order to items

Revision ID: a7f1c9d2e4b8
Revises: c91a7b2d4e10
Create Date: 2026-05-11 17:40:00
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "a7f1c9d2e4b8"
down_revision = "c91a7b2d4e10"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("items", sa.Column("display_order", sa.Integer(), nullable=True))
    op.create_index("ix_items_display_order", "items", ["display_order"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_items_display_order", table_name="items")
    op.drop_column("items", "display_order")

