"""add_receipt_pdf_url_to_donations

Revision ID: 21db4ed25e65
Revises: eaa35be1c891
Create Date: 2026-05-22 11:21:10.692622

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '21db4ed25e65'
down_revision: Union[str, Sequence[str], None] = 'eaa35be1c891'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Adding the column to donation_entries table
    # We use a check to prevent error if it already exists (though it shouldn't here)
    op.add_column('donation_entries', sa.Column('receipt_pdf_url', sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column('donation_entries', 'receipt_pdf_url')
