"""add item_types and link item_categories

Revision ID: b34d9e2c4f11
Revises: a12f4a7b9c01
Create Date: 2026-05-06 16:35:00
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "b34d9e2c4f11"
down_revision = "a12f4a7b9c01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "item_types",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("type_name", sa.String(length=100), nullable=False),
        sa.Column("status", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("updated_by", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("type_name"),
    )

    op.add_column("item_categories", sa.Column("type_id", sa.Integer(), nullable=True))

    op.execute(
        """
        INSERT INTO item_types (type_name, status, created_at, updated_at)
        VALUES ('Kitchen', 1, now(), now())
        ON CONFLICT (type_name) DO NOTHING
        """
    )
    op.execute(
        """
        UPDATE item_categories
        SET type_id = (SELECT id FROM item_types WHERE type_name = 'Kitchen')
        WHERE type_id IS NULL
        """
    )

    op.alter_column("item_categories", "type_id", nullable=False)
    op.create_foreign_key(
        "fk_item_categories_type_id_item_types",
        "item_categories",
        "item_types",
        ["type_id"],
        ["id"],
    )
    op.create_index("ix_item_categories_type_id", "item_categories", ["type_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_item_categories_type_id", table_name="item_categories")
    op.drop_constraint("fk_item_categories_type_id_item_types", "item_categories", type_="foreignkey")
    op.drop_column("item_categories", "type_id")
    op.drop_table("item_types")
