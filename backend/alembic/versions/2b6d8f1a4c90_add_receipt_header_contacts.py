"""add receipt header contacts

Revision ID: 2b6d8f1a4c90
Revises: 3738ed4dc562
Create Date: 2026-06-02 11:30:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "2b6d8f1a4c90"
down_revision: Union[str, None] = "3738ed4dc562"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("system_settings", sa.Column("receipt_office_contact", sa.String(length=100), nullable=True))
    op.add_column("system_settings", sa.Column("receipt_seva_counter_contact", sa.String(length=100), nullable=True))
    op.add_column("system_settings", sa.Column("receipt_guest_house_contact", sa.String(length=100), nullable=True))

    op.execute(
        """
        UPDATE system_settings
        SET
            receipt_office_contact = COALESCE(receipt_office_contact, '74060 93533'),
            receipt_seva_counter_contact = COALESCE(receipt_seva_counter_contact, '94802 72221'),
            receipt_guest_house_contact = COALESCE(receipt_guest_house_contact, '97406 73533')
        """
    )


def downgrade() -> None:
    op.drop_column("system_settings", "receipt_guest_house_contact")
    op.drop_column("system_settings", "receipt_seva_counter_contact")
    op.drop_column("system_settings", "receipt_office_contact")
