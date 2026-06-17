import sys
import os

# Add the backend directory to sys.path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.db.session import SessionLocal
from app.db.models import Role, RolePrivilege, Privilege

def check_privileges():
    db = SessionLocal()
    try:
        # Check privileges for Super Admin (Rank 1)
        super_admin = db.query(Role).filter(Role.rank_level == 1).first()
        if super_admin:
            print(f"--- Super Admin Role: {super_admin.role_name} ---")
            print(f"All Access: {super_admin.is_all_access}")
            
            privs = db.query(RolePrivilege).filter(RolePrivilege.role_id == super_admin.id).all()
            print(f"Explicit Privileges Count: {len(privs)}")
            for rp in privs:
                if rp.privilege:
                    print(f"  - {rp.privilege.privilege_name} (Status: {rp.status})")
        
        # Check Role Management page permissions for common roles
        print("\n--- Role Management (User Privileges) Access ---")
        roles = db.query(Role).all()
        for r in roles:
            priv = db.query(RolePrivilege).join(Privilege).filter(
                RolePrivilege.role_id == r.id,
                Privilege.privilege_name == "users.privileges.read",
                RolePrivilege.status == 1
            ).first()
            has_access = "YES" if priv or r.is_all_access else "NO"
            print(f"Role: {r.role_name} (Rank: {r.rank_level}), All Access: {r.is_all_access}, Has users.privileges.read: {has_access}")

    finally:
        db.close()

if __name__ == "__main__":
    check_privileges()
