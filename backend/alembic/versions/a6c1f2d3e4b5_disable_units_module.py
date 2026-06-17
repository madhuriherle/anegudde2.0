"""disable_units_module

Revision ID: a6c1f2d3e4b5
Revises: 5242795a1a75
Create Date: 2026-05-29 20:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a6c1f2d3e4b5"
down_revision: Union[str, Sequence[str], None] = "5242795a1a75"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text(
            """
            UPDATE modules
            SET status = 0,
                updated_at = now()
            WHERE lower(name) = 'units'
               OR route = '/settings/units'
            """
        )
    )
    conn.execute(
        sa.text(
            """
            UPDATE privileges
            SET status = 0,
                updated_at = now()
            WHERE privilege_name LIKE 'units.%'
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
            WHERE lower(name) = 'units'
               OR route = '/settings/units'
            """
        )
    )
    conn.execute(
        sa.text(
            """
            UPDATE privileges
            SET status = 1,
                updated_at = now()
            WHERE privilege_name LIKE 'units.%'
            """
        )
    )
