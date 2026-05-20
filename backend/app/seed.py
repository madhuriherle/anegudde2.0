from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.db.models import Privilege, Role, RolePrivilege, User
from app.db.session import SessionLocal


ROLE_NAMES = [
    "Super Admin",
    "Temple Trustee",
    "Canteen Manager",
    "Admin",
]

ALL_ACCESS_ROLES = ["Super Admin", "Temple Trustee"]

PRIVILEGES = [
    "vendors.read", "vendors.write", "vendors.delete",
    "items.read", "items.write", "items.delete",
    "units.read", "units.write", "units.delete",
    "item_categories.read", "item_categories.write", "item_categories.delete",
    "item_types.read", "item_types.write", "item_types.delete",
    "purchases.read", "purchases.write", "purchases.delete",
    "purchase_returns.read", "purchase_returns.write", "purchase_returns.delete",
    "consumptions.read", "consumptions.write", "consumptions.delete",
    "wastages.read", "wastages.write", "wastages.delete",
    "vendor_payments.read", "vendor_payments.write", "vendor_payments.delete",
    "tokens.read", "tokens.write", "tokens.delete",
    "menu_items.read", "menu_items.write", "menu_items.delete",
    "donations.read", "donations.write", "donations.delete",
    "donation_types.read", "donation_types.write", "donation_types.delete",
    "devotees.read", "devotees.write", "devotees.delete",
    "stock_adjustments.read", "stock_adjustments.write", "stock_adjustments.delete",
    "reports.read", "dashboard.read",
    "users.read", "users.write", "users.delete",
    "settings.read", "settings.write", "settings.delete",
    "activity_logs.read",
]


def seed_roles(db: Session) -> dict[str, int]:
    role_ids: dict[str, int] = {}
    
    # Check if old combined role exists and rename it to Super Admin
    old_role = db.query(Role).filter(Role.role_name == "Super Admin/Temple Trustee").first()
    if old_role:
        old_role.role_name = "Super Admin"
        db.flush()
        
    # Check if 'Temple Manager' exists and ensure it's named correctly (though it probably is)
    manager_role = db.query(Role).filter(Role.role_name == "Temple Manager").first()
    
    # If the user saw 'Admin' in the screenshot, it might be in the DB already.
    # Let's see what's in there.
    all_roles = db.query(Role).all()
    print(f"Current roles in DB: {[r.role_name for r in all_roles]}")

    for name in ROLE_NAMES:
        role = db.query(Role).filter(Role.role_name == name).first()
        
        # Check for rename: if 'Temple Manager' exists and 'Canteen Manager' doesn't, rename it
        if name == "Canteen Manager":
            old_mgr = db.query(Role).filter(Role.role_name == "Temple Manager").first()
            if old_mgr:
                old_mgr.role_name = "Canteen Manager"
                role = old_mgr

        if not role:
            role = Role(
                role_name=name,
                is_all_access=(name in ALL_ACCESS_ROLES),
                status=1,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )
            db.add(role)
            db.flush()
        else:
            # Update is_all_access for existing roles
            role.is_all_access = (name in ALL_ACCESS_ROLES)
            db.flush()
            
        role_ids[name] = role.id
    return role_ids


def seed_admin_user(db: Session, super_admin_role_id: int) -> int:
    user = db.query(User).filter(User.username == "admin").first()
    if user:
        # If user exists, update their role to Super Admin if it's different
        if user.role_id != super_admin_role_id:
            user.role_id = super_admin_role_id
            db.flush()
        return user.id

    now = datetime.now(timezone.utc)
    admin = User(
        username="admin",
        password=hash_password("admin123"),
        role_id=super_admin_role_id,
        full_name="System Admin",
        email="admin@anegudde.local",
        phone=None,
        status=1,
        created_at=now,
        updated_at=now,
    )
    db.add(admin)
    db.flush()
    return admin.id


def seed_privileges(db: Session, actor_user_id: int) -> dict[str, int]:
    now = datetime.now(timezone.utc)
    ids: dict[str, int] = {}
    for name in PRIVILEGES:
        row = db.query(Privilege).filter(Privilege.privilege_name == name).first()
        if not row:
            row = Privilege(
                privilege_name=name,
                description=f"Permission for {name}",
                status=1,
                created_at=now,
                updated_at=now,
                created_by=actor_user_id,
                updated_by=actor_user_id,
            )
            db.add(row)
            db.flush()
        ids[name] = row.id
    return ids


def seed_role_privileges(db: Session, role_ids: dict[str, int], privilege_ids: dict[str, int], actor_user_id: int) -> None:
    now = datetime.now(timezone.utc)

    super_admin_privs = set(privilege_ids.values())
    trustee_privs = set(privilege_ids.values()) # Trustee also has all privs
    
    manager_priv_names = [
        "items.read", "items.write",
        "item_categories.read", "item_categories.write",
        "item_types.read", "item_types.write",
        "menu_items.read", "menu_items.write",
        "consumptions.read", "consumptions.write",
        "wastages.read", "wastages.write",
        "tokens.read", "tokens.write",
        "reports.read", "dashboard.read",
        "units.read",
        "stock_adjustments.read", "stock_adjustments.write",
    ]
    manager_privs = {privilege_ids[n] for n in manager_priv_names if n in privilege_ids}
    
    admin_privs = manager_privs.copy()
    if "users.read" in privilege_ids:
        admin_privs.add(privilege_ids["users.read"])
    if "users.write" in privilege_ids:
        admin_privs.add(privilege_ids["users.write"])

    mapping = {
        role_ids["Super Admin"]: super_admin_privs,
        role_ids["Temple Trustee"]: trustee_privs,
        role_ids["Canteen Manager"]: manager_privs,
        role_ids["Admin"]: admin_privs,
    }

    for role_id, priv_set in mapping.items():
        for priv_id in priv_set:
            exists = (
                db.query(RolePrivilege)
                .filter(RolePrivilege.role_id == role_id, RolePrivilege.privilege_id == priv_id)
                .first()
            )
            if exists:
                continue
            db.add(
                RolePrivilege(
                    role_id=role_id,
                    privilege_id=priv_id,
                    status=1,
                    created_at=now,
                    updated_at=now,
                    created_by=actor_user_id,
                    updated_by=actor_user_id,
                )
            )


def main() -> None:
    db = SessionLocal()
    try:
        role_ids = seed_roles(db)
        admin_id = seed_admin_user(db, role_ids["Super Admin"])
        privilege_ids = seed_privileges(db, admin_id)
        seed_role_privileges(db, role_ids, privilege_ids, admin_id)
        db.commit()
        print("Seed completed: roles + privileges + role mappings + admin user")
        print("Admin login -> username: admin, password: admin123")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
