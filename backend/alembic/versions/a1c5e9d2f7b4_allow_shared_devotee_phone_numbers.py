"""allow_shared_devotee_phone_numbers

Revision ID: a1c5e9d2f7b4
Revises: f7b8c2d9e4a1
Create Date: 2026-05-15 20:35:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = 'a1c5e9d2f7b4'
down_revision: Union[str, Sequence[str], None] = 'f7b8c2d9e4a1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_index(op.f('ix_devotees_phone_number'), table_name='devotees')
    op.create_index(op.f('ix_devotees_phone_number'), 'devotees', ['phone_number'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_devotees_phone_number'), table_name='devotees')
    op.create_index(op.f('ix_devotees_phone_number'), 'devotees', ['phone_number'], unique=True)
