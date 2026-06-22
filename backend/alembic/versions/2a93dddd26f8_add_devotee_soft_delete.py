"""add_devotee_soft_delete

Revision ID: 2a93dddd26f8
Revises: 8c1489aa0f97
Create Date: 2026-06-19 11:58:48.231846

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '2a93dddd26f8'
down_revision: Union[str, Sequence[str], None] = '8c1489aa0f97'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add soft-delete columns to devotees table
    op.add_column('devotees', sa.Column('is_deleted', sa.Boolean(), server_default=sa.text('false'), nullable=False))
    op.add_column('devotees', sa.Column('deleted_at', sa.DateTime(), nullable=True))
    op.add_column('devotees', sa.Column('deleted_by_id', sa.Integer(), nullable=True))
    op.create_index(op.f('ix_devotees_is_deleted'), 'devotees', ['is_deleted'], unique=False)
    op.create_foreign_key('fk_devotees_deleted_by_id_users', 'devotees', 'users', ['deleted_by_id'], ['id'])


def downgrade() -> None:
    # Drop soft-delete columns from devotees table
    op.drop_constraint('fk_devotees_deleted_by_id_users', 'devotees', type_='foreignkey')
    op.drop_index(op.f('ix_devotees_is_deleted'), table_name='devotees')
    op.drop_column('devotees', 'deleted_by_id')
    op.drop_column('devotees', 'deleted_at')
    op.drop_column('devotees', 'is_deleted')
