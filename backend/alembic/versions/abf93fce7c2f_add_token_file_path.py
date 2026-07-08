"""Add token_file_path

Revision ID: abf93fce7c2f
Revises: d5e6f7a8b9c0
Create Date: 2026-07-08 20:54:59.112783

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'abf93fce7c2f'
down_revision: Union[str, Sequence[str], None] = 'd5e6f7a8b9c0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('system_settings', sa.Column('token_file_path', sa.String(length=500), nullable=True))

def downgrade() -> None:
    op.drop_column('system_settings', 'token_file_path')
