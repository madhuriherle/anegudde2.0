"""add_modules_table

Revision ID: 66e221c3e7a5
Revises: 9a2b6c4d8e10
Create Date: 2026-05-21 16:35:31.033183

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '66e221c3e7a5'
down_revision: Union[str, Sequence[str], None] = '9a2b6c4d8e10'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create modules table
    op.create_table('modules',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.Column('icon', sa.String(length=50), nullable=True),
    sa.Column('parent_id', sa.Integer(), nullable=True),
    sa.Column('route', sa.String(length=255), nullable=True),
    sa.Column('display_order', sa.Integer(), nullable=True),
    sa.Column('status', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('created_by', sa.Integer(), nullable=True),
    sa.Column('updated_by', sa.Integer(), nullable=True),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
    sa.ForeignKeyConstraint(['parent_id'], ['modules.id'], ),
    sa.ForeignKeyConstraint(['updated_by'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_modules_created_by'), 'modules', ['created_by'], unique=False)
    op.create_index(op.f('ix_modules_updated_by'), 'modules', ['updated_by'], unique=False)

    # 2. Add module_id to privileges
    op.add_column('privileges', sa.Column('module_id', sa.Integer(), nullable=True))
    op.create_index(op.f('ix_privileges_module_id'), 'privileges', ['module_id'], unique=False)
    op.create_foreign_key(None, 'privileges', 'modules', ['module_id'], ['id'])


def downgrade() -> None:
    op.drop_constraint(None, 'privileges', type_='foreignkey')
    op.drop_index(op.f('ix_privileges_module_id'), table_name='privileges')
    op.drop_column('privileges', 'module_id')
    op.drop_index(op.f('ix_modules_updated_by'), table_name='modules')
    op.drop_index(op.f('ix_modules_created_by'), table_name='modules')
    op.drop_table('modules')
