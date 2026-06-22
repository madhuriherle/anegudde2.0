"""rename_consumptions_to_daily_usage

Revision ID: d4e5f6a7b8c9
Revises: b2a3c4d5e6f7
Create Date: 2026-06-18 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, Sequence[str], None] = "b2a3c4d5e6f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    for action in ['read', 'write', 'delete']:
        conn.execute(
            sa.text(
                """
                UPDATE privileges
                SET privilege_name = :new_name,
                    updated_at = now()
                WHERE privilege_name = :old_name
                  AND status = 1
                """
            ),
            {"old_name": f"consumptions.{action}", "new_name": f"daily_usage.{action}"},
        )


def downgrade() -> None:
    conn = op.get_bind()

    for action in ['read', 'write', 'delete']:
        conn.execute(
            sa.text(
                """
                UPDATE privileges
                SET privilege_name = :old_name,
                    updated_at = now()
                WHERE privilege_name = :new_name
                  AND status = 1
                """
            ),
            {"old_name": f"consumptions.{action}", "new_name": f"daily_usage.{action}"},
        )
