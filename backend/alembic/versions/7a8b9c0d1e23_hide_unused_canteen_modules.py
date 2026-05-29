"""hide_unused_canteen_modules

Revision ID: 7a8b9c0d1e23
Revises: 6f7a8b9c0d12
Create Date: 2026-05-29 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "7a8b9c0d1e23"
down_revision: Union[str, Sequence[str], None] = "6f7a8b9c0d12"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


DISABLED_MODULE_NAMES = (
    "Devotees",
    "Item Type",
    "Consumption Report",
    "Wastage Report",
)


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text(
            """
            UPDATE modules
            SET status = 0,
                updated_at = now()
            WHERE name = ANY(:names)
            """
        ),
        {"names": list(DISABLED_MODULE_NAMES)},
    )
    conn.execute(
        sa.text(
            """
            UPDATE modules
            SET route = NULL,
                updated_at = now()
            WHERE name = 'Wastages'
            """
        )
    )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text(
            """
            UPDATE modules
            SET status = 1,
                updated_at = now()
            WHERE name = ANY(:names)
            """
        ),
        {"names": list(DISABLED_MODULE_NAMES)},
    )
    conn.execute(
        sa.text(
            """
            UPDATE modules
            SET route = '/wastages',
                updated_at = now()
            WHERE name = 'Wastages'
            """
        )
    )
