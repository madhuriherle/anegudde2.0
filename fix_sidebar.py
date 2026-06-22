import sys
import os

sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.db.session import SessionLocal
from app.db.models import Module, Privilege, RolePrivilege, Role

def fix():
    db = SessionLocal()
    try:
        # 1. Remove icon from Role Management
        role_mod = db.query(Module).filter(Module.name == 'Role Management').first()
        if role_mod:
            role_mod.icon = None
        
        # 2. Hide Module Management
        mod_mgmt = db.query(Module).filter(Module.name == 'Module Management').first()
        if mod_mgmt:
            mod_mgmt.status = 0
        
        # 3. Disable Printer Settings module
        printer_mod = db.query(Module).filter(Module.name == 'Printer Settings').first()
        if printer_mod:
            printer_mod.status = 0
            
            # Check privilege 'settings.printers.read'
            priv = db.query(Privilege).filter(Privilege.privilege_name == 'settings.printers.read').first()
            if not priv:
                priv = Privilege(
                    privilege_name='settings.printers.read',
                    description='Can view printer settings',
                    module_id=printer_mod.id
                )
                db.add(priv)
                db.commit()
                db.refresh(priv)
            else:
                priv.module_id = printer_mod.id
            
            for role_name in ['Super Admin', 'Admin']:
                role = db.query(Role).filter(Role.role_name == role_name).first()
                if role:
                    rp = db.query(RolePrivilege).filter_by(role_id=role.id, privilege_id=priv.id).first()
                    if not rp:
                        db.add(RolePrivilege(role_id=role.id, privilege_id=priv.id, status=1))
                        
        db.commit()
        print("Sidebar fixes applied successfully.")
    finally:
        db.close()

if __name__ == "__main__":
    fix()
