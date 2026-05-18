"""add receipt sequences for tokens donations

Revision ID: d4e5f6a7b890
Revises: c7d8e9f0a123
Create Date: 2026-05-18 14:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd4e5f6a7b890'
down_revision: Union[str, Sequence[str], None] = 'c7d8e9f0a123'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'receipt_sequences',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('financial_year_id', sa.Integer(), nullable=False),
        sa.Column('sequence_type', sa.String(length=30), nullable=False),
        sa.Column('donation_type_id', sa.Integer(), nullable=True),
        sa.Column('prefix', sa.String(length=20), nullable=False),
        sa.Column('last_number', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['donation_type_id'], ['donation_types.id'], ),
        sa.ForeignKeyConstraint(['financial_year_id'], ['financial_years.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_receipt_sequences_donation_type_id'), 'receipt_sequences', ['donation_type_id'], unique=False)
    op.create_index(op.f('ix_receipt_sequences_financial_year_id'), 'receipt_sequences', ['financial_year_id'], unique=False)
    op.create_index(op.f('ix_receipt_sequences_sequence_type'), 'receipt_sequences', ['sequence_type'], unique=False)
    op.create_index(
        'uq_receipt_sequences_general_scope',
        'receipt_sequences',
        ['financial_year_id', 'sequence_type'],
        unique=True,
        postgresql_where=sa.text('donation_type_id IS NULL'),
    )
    op.create_index(
        'uq_receipt_sequences_donation_scope',
        'receipt_sequences',
        ['financial_year_id', 'sequence_type', 'donation_type_id'],
        unique=True,
        postgresql_where=sa.text('donation_type_id IS NOT NULL'),
    )

    op.add_column('donation_entries', sa.Column('financial_year_id', sa.Integer(), nullable=True))
    op.add_column('donation_entries', sa.Column('receipt_prefix', sa.String(length=20), nullable=True))
    op.add_column('donation_entries', sa.Column('receipt_number', sa.Integer(), nullable=True))
    op.add_column('donation_entries', sa.Column('receipt_display_number', sa.String(length=50), nullable=True))
    op.create_index(op.f('ix_donation_entries_financial_year_id'), 'donation_entries', ['financial_year_id'], unique=False)
    op.create_index(op.f('ix_donation_entries_receipt_display_number'), 'donation_entries', ['receipt_display_number'], unique=False)
    op.create_foreign_key('fk_donation_entries_financial_year_id', 'donation_entries', 'financial_years', ['financial_year_id'], ['id'])

    op.add_column('token_details', sa.Column('financial_year_id', sa.Integer(), nullable=True))
    op.add_column('token_details', sa.Column('receipt_prefix', sa.String(length=20), nullable=True))
    op.add_column('token_details', sa.Column('receipt_display_number', sa.String(length=50), nullable=True))
    op.create_index(op.f('ix_token_details_financial_year_id'), 'token_details', ['financial_year_id'], unique=False)
    op.create_index(op.f('ix_token_details_receipt_display_number'), 'token_details', ['receipt_display_number'], unique=False)
    op.create_foreign_key('fk_token_details_financial_year_id', 'token_details', 'financial_years', ['financial_year_id'], ['id'])


def downgrade() -> None:
    op.drop_constraint('fk_token_details_financial_year_id', 'token_details', type_='foreignkey')
    op.drop_index(op.f('ix_token_details_receipt_display_number'), table_name='token_details')
    op.drop_index(op.f('ix_token_details_financial_year_id'), table_name='token_details')
    op.drop_column('token_details', 'receipt_display_number')
    op.drop_column('token_details', 'receipt_prefix')
    op.drop_column('token_details', 'financial_year_id')

    op.drop_constraint('fk_donation_entries_financial_year_id', 'donation_entries', type_='foreignkey')
    op.drop_index(op.f('ix_donation_entries_receipt_display_number'), table_name='donation_entries')
    op.drop_index(op.f('ix_donation_entries_financial_year_id'), table_name='donation_entries')
    op.drop_column('donation_entries', 'receipt_display_number')
    op.drop_column('donation_entries', 'receipt_number')
    op.drop_column('donation_entries', 'receipt_prefix')
    op.drop_column('donation_entries', 'financial_year_id')

    op.drop_index('uq_receipt_sequences_donation_scope', table_name='receipt_sequences')
    op.drop_index('uq_receipt_sequences_general_scope', table_name='receipt_sequences')
    op.drop_index(op.f('ix_receipt_sequences_sequence_type'), table_name='receipt_sequences')
    op.drop_index(op.f('ix_receipt_sequences_financial_year_id'), table_name='receipt_sequences')
    op.drop_index(op.f('ix_receipt_sequences_donation_type_id'), table_name='receipt_sequences')
    op.drop_table('receipt_sequences')
