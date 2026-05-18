"""add donation types master

Revision ID: b8c2d4e6f901
Revises: a9d4e6f8b123
Create Date: 2026-05-18 12:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b8c2d4e6f901'
down_revision: Union[str, Sequence[str], None] = 'a9d4e6f8b123'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


donation_types = sa.table(
    'donation_types',
    sa.column('id', sa.Integer),
    sa.column('type_name', sa.String),
    sa.column('receipt_prefix', sa.String),
    sa.column('status', sa.Integer),
)


def upgrade() -> None:
    op.create_table(
        'donation_types',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('type_name', sa.String(length=100), nullable=False),
        sa.Column('receipt_prefix', sa.String(length=20), nullable=False),
        sa.Column('status', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('updated_by', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('type_name'),
    )
    op.create_index(op.f('ix_donation_types_status'), 'donation_types', ['status'], unique=False)

    op.bulk_insert(
        donation_types,
        [
            {'id': 1, 'type_name': 'General Donation', 'receipt_prefix': 'DON-', 'status': 1},
            {'id': 2, 'type_name': 'Annadana Donation', 'receipt_prefix': 'ANN-', 'status': 1},
            {'id': 3, 'type_name': 'Seva Donation', 'receipt_prefix': 'SEVA-', 'status': 1},
            {'id': 4, 'type_name': 'Others', 'receipt_prefix': 'OTH-', 'status': 1},
        ],
    )
    op.execute("SELECT setval(pg_get_serial_sequence('donation_types', 'id'), (SELECT MAX(id) FROM donation_types))")
    op.create_foreign_key(
        'fk_donation_entries_donation_type_donation_types',
        'donation_entries',
        'donation_types',
        ['donation_type'],
        ['id'],
    )


def downgrade() -> None:
    op.drop_constraint('fk_donation_entries_donation_type_donation_types', 'donation_entries', type_='foreignkey')
    op.drop_index(op.f('ix_donation_types_status'), table_name='donation_types')
    op.drop_table('donation_types')
