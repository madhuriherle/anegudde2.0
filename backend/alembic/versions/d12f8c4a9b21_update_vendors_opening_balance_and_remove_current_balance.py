"""update vendors opening_balance and remove current_balance

Revision ID: d12f8c4a9b21
Revises: c91a7b2d4e10
Create Date: 2026-05-06 16:35:00
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "d12f8c4a9b21"
down_revision = "c91a7b2d4e10"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("vendors", "current_balance")
    op.alter_column(
        "vendors",
        "opening_balance",
        existing_type=sa.Numeric(precision=15, scale=3),
        type_=sa.Text(),
        existing_nullable=False,
        postgresql_using="opening_balance::text",
    )


def downgrade() -> None:
    op.alter_column(
        "vendors",
        "opening_balance",
        existing_type=sa.Text(),
        type_=sa.Numeric(precision=15, scale=3),
        existing_nullable=False,
        postgresql_using="opening_balance::numeric",
    )
    op.add_column(
        "vendors",
        sa.Column("current_balance", sa.Numeric(precision=15, scale=3), nullable=False, server_default=sa.text("0")),
    )
    op.alter_column("vendors", "current_balance", server_default=None)
