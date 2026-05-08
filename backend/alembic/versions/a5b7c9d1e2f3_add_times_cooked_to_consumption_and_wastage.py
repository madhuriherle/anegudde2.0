"""add_times_cooked_to_consumption_and_wastage

Revision ID: a5b7c9d1e2f3
Revises: f964efe7af59
Create Date: 2026-05-07 21:45:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a5b7c9d1e2f3"
down_revision: Union[str, Sequence[str], None] = "f964efe7af59"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "consumption_entries",
        sa.Column("times_cooked", sa.Integer(), nullable=False, server_default=sa.text("0")),
    )
    op.add_column(
        "wastage_entries",
        sa.Column("times_cooked", sa.Integer(), nullable=False, server_default=sa.text("0")),
    )


def downgrade() -> None:
    op.drop_column("wastage_entries", "times_cooked")
    op.drop_column("consumption_entries", "times_cooked")
