"""remove_tokens_delete_privilege

Revision ID: c9d8e7f6a5b4
Revises: 1e22e038a432
Create Date: 2026-06-18 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c9d8e7f6a5b4"
down_revision: Union[str, Sequence[str], None] = "1e22e038a432"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text(
            """
            UPDATE privileges
            SET status = 0,
                updated_at = now()
            WHERE privilege_name = 'tokens.delete'
              AND status = 1
            """
        )
    )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text(
            """
            UPDATE privileges
            SET status = 1,
                updated_at = now()
            WHERE privilege_name = 'tokens.delete'
              AND status = 0
            """
        )
    )
