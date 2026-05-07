"""add consumption manpower and raw return fields

Revision ID: 9f2c7d4a1b33
Revises: b3849b8badd6
Create Date: 2026-05-07 12:45:00.000000

"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "9f2c7d4a1b33"
down_revision: Union[str, Sequence[str], None] = "b3849b8badd6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE consumption_entries
        ADD COLUMN IF NOT EXISTS remarks TEXT,
        ADD COLUMN IF NOT EXISTS regular_cooking_persons INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS additional_cooking_persons INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS regular_cleaning_persons INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS additional_cleaning_persons INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS regular_serving_persons INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS additional_serving_persons INTEGER NOT NULL DEFAULT 0
        """
    )

    op.execute(
        """
        ALTER TABLE consumption_items
        ADD COLUMN IF NOT EXISTS qty_returned NUMERIC(15,3) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS net_quantity NUMERIC(15,3) NOT NULL DEFAULT 0
        """
    )

    # Backfill for existing rows.
    op.execute(
        """
        UPDATE consumption_items
        SET net_quantity = COALESCE(quantity_used, 0) - COALESCE(qty_returned, 0)
        WHERE net_quantity = 0
        """
    )

    op.execute(
        """
        ALTER TABLE consumption_entries
        ADD CONSTRAINT ck_consumption_entries_regular_cooking_non_negative
        CHECK (regular_cooking_persons >= 0) NOT VALID
        """
    )
    op.execute(
        """
        ALTER TABLE consumption_entries
        ADD CONSTRAINT ck_consumption_entries_additional_cooking_non_negative
        CHECK (additional_cooking_persons >= 0) NOT VALID
        """
    )
    op.execute(
        """
        ALTER TABLE consumption_entries
        ADD CONSTRAINT ck_consumption_entries_regular_cleaning_non_negative
        CHECK (regular_cleaning_persons >= 0) NOT VALID
        """
    )
    op.execute(
        """
        ALTER TABLE consumption_entries
        ADD CONSTRAINT ck_consumption_entries_additional_cleaning_non_negative
        CHECK (additional_cleaning_persons >= 0) NOT VALID
        """
    )
    op.execute(
        """
        ALTER TABLE consumption_entries
        ADD CONSTRAINT ck_consumption_entries_regular_serving_non_negative
        CHECK (regular_serving_persons >= 0) NOT VALID
        """
    )
    op.execute(
        """
        ALTER TABLE consumption_entries
        ADD CONSTRAINT ck_consumption_entries_additional_serving_non_negative
        CHECK (additional_serving_persons >= 0) NOT VALID
        """
    )
    op.execute(
        """
        ALTER TABLE consumption_items
        ADD CONSTRAINT ck_consumption_items_quantity_used_non_negative
        CHECK (quantity_used >= 0) NOT VALID
        """
    )
    op.execute(
        """
        ALTER TABLE consumption_items
        ADD CONSTRAINT ck_consumption_items_qty_returned_non_negative
        CHECK (qty_returned >= 0) NOT VALID
        """
    )
    op.execute(
        """
        ALTER TABLE consumption_items
        ADD CONSTRAINT ck_consumption_items_qty_returned_lte_used
        CHECK (qty_returned <= quantity_used) NOT VALID
        """
    )
    op.execute(
        """
        ALTER TABLE consumption_items
        ADD CONSTRAINT ck_consumption_items_net_quantity_non_negative
        CHECK (net_quantity >= 0) NOT VALID
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE consumption_items DROP CONSTRAINT IF EXISTS ck_consumption_items_net_quantity_non_negative")
    op.execute("ALTER TABLE consumption_items DROP CONSTRAINT IF EXISTS ck_consumption_items_qty_returned_lte_used")
    op.execute("ALTER TABLE consumption_items DROP CONSTRAINT IF EXISTS ck_consumption_items_qty_returned_non_negative")
    op.execute("ALTER TABLE consumption_items DROP CONSTRAINT IF EXISTS ck_consumption_items_quantity_used_non_negative")

    op.execute("ALTER TABLE consumption_entries DROP CONSTRAINT IF EXISTS ck_consumption_entries_additional_serving_non_negative")
    op.execute("ALTER TABLE consumption_entries DROP CONSTRAINT IF EXISTS ck_consumption_entries_regular_serving_non_negative")
    op.execute("ALTER TABLE consumption_entries DROP CONSTRAINT IF EXISTS ck_consumption_entries_additional_cleaning_non_negative")
    op.execute("ALTER TABLE consumption_entries DROP CONSTRAINT IF EXISTS ck_consumption_entries_regular_cleaning_non_negative")
    op.execute("ALTER TABLE consumption_entries DROP CONSTRAINT IF EXISTS ck_consumption_entries_additional_cooking_non_negative")
    op.execute("ALTER TABLE consumption_entries DROP CONSTRAINT IF EXISTS ck_consumption_entries_regular_cooking_non_negative")

    op.execute(
        """
        ALTER TABLE consumption_items
        DROP COLUMN IF EXISTS net_quantity,
        DROP COLUMN IF EXISTS qty_returned
        """
    )

    op.execute(
        """
        ALTER TABLE consumption_entries
        DROP COLUMN IF EXISTS additional_serving_persons,
        DROP COLUMN IF EXISTS regular_serving_persons,
        DROP COLUMN IF EXISTS additional_cleaning_persons,
        DROP COLUMN IF EXISTS regular_cleaning_persons,
        DROP COLUMN IF EXISTS additional_cooking_persons,
        DROP COLUMN IF EXISTS regular_cooking_persons,
        DROP COLUMN IF EXISTS remarks
        """
    )
