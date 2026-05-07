"""add cooked remained fields to consumption entries

Revision ID: ab12cd34ef56
Revises: 9f2c7d4a1b33
Create Date: 2026-05-07 14:10:00.000000
"""

from typing import Sequence, Union

from alembic import op


revision: str = "ab12cd34ef56"
down_revision: Union[str, Sequence[str], None] = "9f2c7d4a1b33"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE consumption_entries
        ADD COLUMN IF NOT EXISTS anna_remained NUMERIC(15,3) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS saru_remained NUMERIC(15,3) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS huli_remained NUMERIC(15,3) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS payas_remained NUMERIC(15,3) NOT NULL DEFAULT 0
        """
    )

    op.execute(
        """
        ALTER TABLE consumption_entries
        ADD CONSTRAINT ck_consumption_entries_anna_remained_non_negative
        CHECK (anna_remained >= 0) NOT VALID
        """
    )
    op.execute(
        """
        ALTER TABLE consumption_entries
        ADD CONSTRAINT ck_consumption_entries_saru_remained_non_negative
        CHECK (saru_remained >= 0) NOT VALID
        """
    )
    op.execute(
        """
        ALTER TABLE consumption_entries
        ADD CONSTRAINT ck_consumption_entries_huli_remained_non_negative
        CHECK (huli_remained >= 0) NOT VALID
        """
    )
    op.execute(
        """
        ALTER TABLE consumption_entries
        ADD CONSTRAINT ck_consumption_entries_payas_remained_non_negative
        CHECK (payas_remained >= 0) NOT VALID
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE consumption_entries DROP CONSTRAINT IF EXISTS ck_consumption_entries_payas_remained_non_negative")
    op.execute("ALTER TABLE consumption_entries DROP CONSTRAINT IF EXISTS ck_consumption_entries_huli_remained_non_negative")
    op.execute("ALTER TABLE consumption_entries DROP CONSTRAINT IF EXISTS ck_consumption_entries_saru_remained_non_negative")
    op.execute("ALTER TABLE consumption_entries DROP CONSTRAINT IF EXISTS ck_consumption_entries_anna_remained_non_negative")

    op.execute(
        """
        ALTER TABLE consumption_entries
        DROP COLUMN IF EXISTS payas_remained,
        DROP COLUMN IF EXISTS huli_remained,
        DROP COLUMN IF EXISTS saru_remained,
        DROP COLUMN IF EXISTS anna_remained
        """
    )
