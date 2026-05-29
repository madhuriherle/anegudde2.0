"""add_amount_donation_support

Revision ID: 4b1f2c3d9a80
Revises: 21db4ed25e65
Create Date: 2026-05-28 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "4b1f2c3d9a80"
down_revision: Union[str, Sequence[str], None] = "21db4ed25e65"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("user_code", sa.String(length=20), nullable=True))

    op.create_table(
        "donation_amount_masters",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=150), nullable=False),
        sa.Column("amount", sa.Numeric(15, 3), nullable=False),
        sa.Column("description", sa.String(length=255), nullable=True),
        sa.Column("status", sa.Integer(), server_default="1", nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("updated_by", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_donation_amount_masters_status"), "donation_amount_masters", ["status"], unique=False)
    op.create_index(op.f("ix_donation_amount_masters_created_by"), "donation_amount_masters", ["created_by"], unique=False)
    op.create_index(op.f("ix_donation_amount_masters_updated_by"), "donation_amount_masters", ["updated_by"], unique=False)

    op.add_column("donation_entries", sa.Column("donation_mode", sa.String(length=20), server_default="ITEM", nullable=False))
    op.add_column("donation_entries", sa.Column("total_gross_amount", sa.Numeric(15, 3), nullable=True))
    op.add_column("donation_entries", sa.Column("amount_donation_type", sa.String(length=20), nullable=True))
    op.add_column("donation_entries", sa.Column("donation_amount_master_id", sa.Integer(), nullable=True))
    op.add_column("donation_entries", sa.Column("amount_note", sa.Text(), nullable=True))
    op.add_column("donation_entries", sa.Column("user_code", sa.String(length=20), nullable=True))
    op.create_index(op.f("ix_donation_entries_donation_mode"), "donation_entries", ["donation_mode"], unique=False)
    op.create_index(op.f("ix_donation_entries_donation_amount_master_id"), "donation_entries", ["donation_amount_master_id"], unique=False)
    op.create_foreign_key(
        op.f("fk_donation_entries_donation_amount_master_id_donation_amount_masters"),
        "donation_entries",
        "donation_amount_masters",
        ["donation_amount_master_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint(op.f("fk_donation_entries_donation_amount_master_id_donation_amount_masters"), "donation_entries", type_="foreignkey")
    op.drop_index(op.f("ix_donation_entries_donation_amount_master_id"), table_name="donation_entries")
    op.drop_index(op.f("ix_donation_entries_donation_mode"), table_name="donation_entries")
    op.drop_column("donation_entries", "user_code")
    op.drop_column("donation_entries", "amount_note")
    op.drop_column("donation_entries", "donation_amount_master_id")
    op.drop_column("donation_entries", "amount_donation_type")
    op.drop_column("donation_entries", "total_gross_amount")
    op.drop_column("donation_entries", "donation_mode")

    op.drop_index(op.f("ix_donation_amount_masters_updated_by"), table_name="donation_amount_masters")
    op.drop_index(op.f("ix_donation_amount_masters_created_by"), table_name="donation_amount_masters")
    op.drop_index(op.f("ix_donation_amount_masters_status"), table_name="donation_amount_masters")
    op.drop_table("donation_amount_masters")
    op.drop_column("users", "user_code")
