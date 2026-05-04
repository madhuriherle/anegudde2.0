from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.db.models import Privilege, Role, RolePrivilege, User
from app.db.session import SessionLocal


ROLE_NAMES = [
    "Super Admin/Temple Trustee",
    "Temple Manager",
]

PRIVILEGES = [
    "vendors.read", "vendors.write",
    "items.read", "items.write",
    "units.read", "units.write",
    "item_categories.read", "item_categories.write",
    "purchases.read", "purchases.write",
    "consumptions.read", "consumptions.write",
    "wastages.read", "wastages.write",
    "vendor_payments.read", "vendor_payments.write",
    "reports.read", "dashboard.read",
    "users.read",
]


def seed_roles(db: Session) -> dict[str, int]:
    role_ids: dict[str, int] = {}
    for name in ROLE_NAMES:
        role = db.query(Role).filter(Role.role_name == name).first()
        if not role:
            role = Role(
                role_name=name,
                status=1,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )
            db.add(role)
            db.flush()
        role_ids[name] = role.id
    return role_ids


def seed_admin_user(db: Session, super_admin_role_id: int) -> int:
    user = db.query(User).filter(User.username == "admin").first()
    if user:
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
    manager_priv_names = [
        "vendors.read", "vendors.write",
        "items.read", "items.write",
        "units.read", "units.write",
        "item_categories.read", "item_categories.write",
        "purchases.read", "purchases.write",
        "consumptions.read", "consumptions.write",
        "wastages.read", "wastages.write",
        "vendor_payments.read", "vendor_payments.write",
        "reports.read", "dashboard.read",
    ]
    manager_privs = {privilege_ids[n] for n in manager_priv_names if n in privilege_ids}

    mapping = {
        role_ids["Super Admin/Temple Trustee"]: super_admin_privs,
        role_ids["Temple Manager"]: manager_privs,
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
        admin_id = seed_admin_user(db, role_ids["Super Admin/Temple Trustee"])
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
