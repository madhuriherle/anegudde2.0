"""add_role_rank_and_user_security_stamp

Revision ID: eaa35be1c891
Revises: 66e221c3e7a5
Create Date: 2026-05-22 10:12:47.168418

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'eaa35be1c891'
down_revision: Union[str, Sequence[str], None] = '66e221c3e7a5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add rank_level to roles
    op.add_column('roles', sa.Column('rank_level', sa.Integer(), nullable=False, server_default='99'))
    
    # Add security_stamp to users
    op.add_column('users', sa.Column('security_stamp', sa.String(length=100), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'security_stamp')
    op.drop_column('roles', 'rank_level')
