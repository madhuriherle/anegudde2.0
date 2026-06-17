"""add_printer_configs_table

Revision ID: 4f8b5f17fef9
Revises: 051bdebdd35e
Create Date: 2026-06-16 11:41:52.255274

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '4f8b5f17fef9'
down_revision: Union[str, Sequence[str], None] = '051bdebdd35e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('printer_configs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('machine_id', sa.String(length=100), nullable=True),
        sa.Column('context', sa.String(length=50), nullable=False),
        sa.Column('printer_name', sa.String(length=255), nullable=False),
        sa.Column('is_default', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('updated_by', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('machine_id', 'context', name='uq_machine_context')
    )
    op.create_index(op.f('ix_printer_configs_created_by'), 'printer_configs', ['created_by'], unique=False)
    op.create_index(op.f('ix_printer_configs_machine_id'), 'printer_configs', ['machine_id'], unique=False)
    op.create_index(op.f('ix_printer_configs_updated_by'), 'printer_configs', ['updated_by'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_printer_configs_updated_by'), table_name='printer_configs')
    op.drop_index(op.f('ix_printer_configs_machine_id'), table_name='printer_configs')
    op.drop_index(op.f('ix_printer_configs_created_by'), table_name='printer_configs')
    op.drop_table('printer_configs')
