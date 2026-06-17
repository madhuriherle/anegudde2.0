import sys
import os

# Add the backend directory to sys.path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.db.session import SessionLocal
from app.db.models import Role, RolePrivilege, Privilege

def fix_privileges():
    db = SessionLocal()
    try:
        super_admin = db.query(Role).filter(Role.role_name == "Super Admin").first()
        if not super_admin:
            print("Super Admin role not found")
            return

        # List of missing critical privileges for Super Admin
        missing_privs = [
            "users.privileges.read",
            "users.privileges.write",
            "users.modules.read",
            "users.modules.write",
            "users.modules.delete",
            "reports.purchases.read",
            "reports.consumptions.read",
            "reports.wastages.read",
            "settings.temple_identity.read",
            "settings.temple_identity.write",
            "settings.receipt_settings.read",
            "settings.receipt_settings.write",
            "settings.data_cleanup.read",
            "settings.data_cleanup.write"
        ]

        for priv_name in missing_privs:
            priv = db.query(Privilege).filter(Privilege.privilege_name == priv_name).first()
            if not priv:
                print(f"Privilege {priv_name} not found in database!")
                continue
            
            # Check if Super Admin already has it
            rp = db.query(RolePrivilege).filter(
                RolePrivilege.role_id == super_admin.id,
                RolePrivilege.privilege_id == priv.id
            ).first()
            
            if not rp:
                print(f"Adding {priv_name} to Super Admin")
                new_rp = RolePrivilege(
                    role_id=super_admin.id,
                    privilege_id=priv.id,
                    status=1
                )
                db.add(new_rp)
            elif rp.status != 1:
                print(f"Enabling {priv_name} for Super Admin")
                rp.status = 1
        
        db.commit()
        print("Super Admin privileges updated successfully")

    finally:
        db.close()

if __name__ == "__main__":
    fix_privileges()
