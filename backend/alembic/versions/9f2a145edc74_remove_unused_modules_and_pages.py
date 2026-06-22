"""remove_unused_modules_and_pages

Revision ID: 9f2a145edc74
Revises: e1f2a3b4c5d6
Create Date: 2026-06-18 20:55:00.562818

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9f2a145edc74'
down_revision: Union[str, Sequence[str], None] = 'e1f2a3b4c5d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: delete inactive/unused modules and their privileges."""
    conn = op.get_bind()
    
    # 1. Delete associated role privileges
    conn.execute(
        sa.text(
            """
            DELETE FROM role_privileges WHERE privilege_id IN (
                SELECT id FROM privileges WHERE module_id IN (
                    SELECT id FROM modules WHERE name IN ('Units', 'Debug', 'Consumption Report', 'Wastage Report') 
                    OR (name = 'Dashboard' AND route = '/canteen' AND status = 0)
                )
            )
            """
        )
    )
    
    # 2. Delete associated privileges
    conn.execute(
        sa.text(
            """
            DELETE FROM privileges WHERE module_id IN (
                SELECT id FROM modules WHERE name IN ('Units', 'Debug', 'Consumption Report', 'Wastage Report') 
                OR (name = 'Dashboard' AND route = '/canteen' AND status = 0)
            )
            """
        )
    )
    
    # 3. Reset any references on modules/roles
    conn.execute(
        sa.text(
            """
            UPDATE modules SET opens_module_id = NULL WHERE opens_module_id IN (
                SELECT id FROM modules WHERE name IN ('Units', 'Debug', 'Consumption Report', 'Wastage Report') 
                OR (name = 'Dashboard' AND route = '/canteen' AND status = 0)
            )
            """
        )
    )
    
    conn.execute(
        sa.text(
            """
            UPDATE roles SET module_id = NULL WHERE module_id IN (
                SELECT id FROM modules WHERE name IN ('Units', 'Debug', 'Consumption Report', 'Wastage Report') 
                OR (name = 'Dashboard' AND route = '/canteen' AND status = 0)
            )
            """
        )
    )
    
    # 4. Delete the modules
    conn.execute(
        sa.text(
            """
            DELETE FROM modules WHERE name IN ('Units', 'Debug', 'Consumption Report', 'Wastage Report') 
            OR (name = 'Dashboard' AND route = '/canteen' AND status = 0)
            """
        )
    )


def downgrade() -> None:
    """Downgrade schema."""
    pass
