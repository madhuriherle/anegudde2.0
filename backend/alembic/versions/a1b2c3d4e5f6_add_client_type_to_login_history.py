"""add client_type to login_history

Revision ID: a1b2c3d4e5f6
Revises: fdc5fb5ea789
Create Date: 2026-06-22 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'fdc5fb5ea789'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('login_history', sa.Column('client_type', sa.String(20), nullable=True))


def downgrade() -> None:
    op.drop_column('login_history', 'client_type')
