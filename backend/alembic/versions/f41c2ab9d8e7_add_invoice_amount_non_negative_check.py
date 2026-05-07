"""add invoice amount non-negative check

Revision ID: f41c2ab9d8e7
Revises: 349755408b19
Create Date: 2026-05-07 01:10:00.000000

"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "f41c2ab9d8e7"
down_revision: Union[str, Sequence[str], None] = "349755408b19"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Use NOT VALID so existing legacy rows do not block migration.
    op.execute(
        """
        ALTER TABLE purchase_entries
        ADD CONSTRAINT ck_purchase_entries_invoice_amount_non_negative
        CHECK (invoice_amount IS NULL OR invoice_amount >= 0) NOT VALID
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE purchase_entries
        DROP CONSTRAINT IF EXISTS ck_purchase_entries_invoice_amount_non_negative
        """
    )

