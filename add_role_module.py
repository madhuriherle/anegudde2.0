import sys
import os

sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.db.session import SessionLocal
from app.db.models import Module, Privilege, RolePrivilege, Role

def add_role_module():
    db = SessionLocal()
    try:
        users_mod = db.query(Module).filter(Module.name == 'Users').first()
        if not users_mod:
            print("Users module not found!")
            return

        role_mod = db.query(Module).filter(Module.name == 'Role Management', Module.parent_id == users_mod.id).first()
        if not role_mod:
            role_mod = Module(
                name='Role Management',
                route='/users/roles',
                parent_id=users_mod.id,
                display_order=1,
                icon='Shield'
            )
            db.add(role_mod)
            db.commit()
            db.refresh(role_mod)
            print("Added Role Management module with ID:", role_mod.id)
        else:
            # ensure route is correct
            if role_mod.route != '/users/roles':
                role_mod.route = '/users/roles'
                db.commit()
            print("Role Management module already exists.")

        # Let's ensure users.privileges.read is linked to both Role Management and User Privileges, or at least Role Management is accessible.
        # Actually, in navigation.js, mainPermissions has users.privileges.read, users.management.read, etc.
        # Let's make sure Super Admin has users.privileges.read
        super_admin = db.query(Role).filter(Role.role_name == 'Super Admin').first()
        priv = db.query(Privilege).filter(Privilege.name == 'users.privileges.read').first()
        if super_admin and priv:
            rp = db.query(RolePrivilege).filter_by(role_id=super_admin.id, privilege_id=priv.id).first()
            if not rp:
                db.add(RolePrivilege(role_id=super_admin.id, privilege_id=priv.id, status=1))
                db.commit()
                print("Granted users.privileges.read to Super Admin")

    finally:
        db.close()

if __name__ == "__main__":
    add_role_module()
