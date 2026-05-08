"""add approx_amount to wastage_items

Revision ID: c2f9a3d4b6e1
Revises: 785f9ae89ced
Create Date: 2026-05-08 18:05:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c2f9a3d4b6e1"
down_revision: Union[str, Sequence[str], None] = "785f9ae89ced"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "wastage_items",
        sa.Column("approx_amount", sa.Numeric(15, 3), nullable=False, server_default=sa.text("0")),
    )


def downgrade() -> None:
    op.drop_column("wastage_items", "approx_amount")

