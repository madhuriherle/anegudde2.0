import sys
import os

sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.db.session import SessionLocal
from app.db.models import Module, Privilege, RolePrivilege, Role

def link_role_privs():
    db = SessionLocal()
    try:
        role_mod = db.query(Module).filter(Module.name == 'Role Management').first()
        if not role_mod:
            print("Role Management module not found!")
            return

        # Find users.privileges.read
        read_priv = db.query(Privilege).filter(Privilege.privilege_name == 'users.privileges.read').first()
        if read_priv:
            # We must link users.privileges.read to the Role Management module 
            # so it shows up for users who have this privilege!
            # However, a privilege can only belong to one module_id currently?
            # Let's check Privilege model:
            print("Read priv module_id:", read_priv.module_id)
            if read_priv.module_id != role_mod.id:
                # If we change it, "User Privileges" module might lose it. 
                # Let's see if "User Privileges" module has its own.
                pass
        
        # Actually, let's just create 'roles.read', 'roles.write', 'roles.delete' 
        # and link them to Role Management, and grant them to Super Admin and Admin.
        for action in ['read', 'write', 'delete']:
            priv_name = f'roles.{action}'
            priv = db.query(Privilege).filter(Privilege.privilege_name == priv_name).first()
            if not priv:
                priv = Privilege(
                    privilege_name=priv_name,
                    description=f'Can {action} roles',
                    module_id=role_mod.id
                )
                db.add(priv)
                db.commit()
                db.refresh(priv)
                print(f"Created privilege {priv_name}")
            else:
                priv.module_id = role_mod.id
                db.commit()
            
            # Grant to Super Admin & Admin
            for role_name in ['Super Admin', 'Admin']:
                role = db.query(Role).filter(Role.role_name == role_name).first()
                if role:
                    rp = db.query(RolePrivilege).filter_by(role_id=role.id, privilege_id=priv.id).first()
                    if not rp:
                        db.add(RolePrivilege(role_id=role.id, privilege_id=priv.id, status=1))
                        db.commit()
                        print(f"Granted {priv_name} to {role_name}")

    finally:
        db.close()

if __name__ == "__main__":
    link_role_privs()
