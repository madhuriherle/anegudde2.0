"""add_min_rank_level_to_modules

Revision ID: 5242795a1a75
Revises: 8b9c0d1e2f34
Create Date: 2026-05-29 11:56:43.782218

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5242795a1a75'
down_revision: Union[str, Sequence[str], None] = '8b9c0d1e2f34'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('modules', sa.Column('min_rank_level', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('modules', 'min_rank_level')
