from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user, get_db, AnyPermissionChecker, PermissionChecker
from app.db.models import Role, User, Privilege, RolePrivilege
from app.schemas.user import RoleOut, PrivilegeOut, RolePrivilegeUpdate, RoleCreate, RoleUpdate

router = APIRouter()


@router.get("/list_roles", response_model=list[RoleOut])
def list_roles(
    db: Session = Depends(get_db),
    current_user: User = Depends(AnyPermissionChecker([
        "roles.read",
        "users.management.read",
        "users.privileges.read",
    ])),
):
    """
    List all active roles. Super admin sees all, others see only weaker roles.
    """
    my_rank = current_user.role.rank_level if current_user.role else 99

    query = db.query(Role).filter(Role.is_deleted == False, Role.status == 1)

    # If not developer (rank 1), only show roles with higher rank (weaker)
    if my_rank > 1:
        query = query.filter(Role.rank_level > my_rank)

    return query.order_by(Role.rank_level).all()


@router.post("/create_role", response_model=RoleOut)
def create_role(
    payload: RoleCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("roles.write"))
):
    my_rank = current_user.role.rank_level if current_user.role else 99

    # Can only create roles weaker than self
    if payload.rank_level <= my_rank:
        raise HTTPException(status_code=400, detail="Cannot create role with same or higher rank than yours")

    # Check if name exists (exclude soft-deleted)
    existing = db.query(Role).filter(
        Role.role_name == payload.role_name,
        Role.is_deleted == False
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Role name already exists")

    new_role = Role(
        **payload.model_dump(),
        created_by=current_user.id,
        updated_by=current_user.id
    )
    db.add(new_role)
    db.commit()
    db.refresh(new_role)
    request.state.audit_meta = {
        "role_name": new_role.role_name,
        "snapshot": {
            "id": new_role.id,
            "role_name": new_role.role_name,
            "rank_level": new_role.rank_level,
            "module_id": new_role.module_id,
            "is_all_access": new_role.is_all_access,
        }
    }
    return new_role


@router.put("/update_role/{role_id}", response_model=RoleOut)
def update_role(
    role_id: int,
    payload: RoleUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("roles.write"))
):
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    my_rank = current_user.role.rank_level if current_user.role else 99

    # Can only update roles weaker than self
    if role.rank_level <= my_rank:
        raise HTTPException(status_code=403, detail="Cannot update role with same or higher rank")

    # If updating rank, new rank must also be weaker than self
    if payload.rank_level is not None and payload.rank_level <= my_rank:
        raise HTTPException(status_code=400, detail="New rank must be weaker than yours")

    # Check duplicate name (exclude self and soft-deleted)
    if payload.role_name is not None and payload.role_name != role.role_name:
        existing = db.query(Role).filter(
            Role.role_name == payload.role_name,
            Role.is_deleted == False
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Role name already exists")

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(role, key, value)

    role.updated_by = current_user.id
    db.commit()
    db.refresh(role)
    request.state.audit_meta = {
        "role_name": role.role_name,
        "snapshot": {
            "id": role.id,
            "role_name": role.role_name,
            "rank_level": role.rank_level,
            "module_id": role.module_id,
            "is_all_access": role.is_all_access,
        }
    }
    return role



@router.delete("/delete_role/{role_id}")
def delete_role(
    role_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("roles.delete"))
):
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    my_rank = current_user.role.rank_level if current_user.role else 99
    if role.rank_level <= my_rank:
        raise HTTPException(status_code=403, detail="Cannot delete role with same or higher rank")

    # Check if users are using this role
    user_count = db.query(User).filter(User.role_id == role_id, User.status == 1, User.is_deleted == False).count()
    if user_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete role. It is assigned to {user_count} active users.")

    request.state.audit_meta = {
        "role_name": role.role_name,
        "snapshot": {
            "id": role.id,
            "role_name": role.role_name,
            "rank_level": role.rank_level,
            "module_id": role.module_id,
            "is_all_access": role.is_all_access,
        }
    }

    from datetime import datetime, timezone
    role.is_deleted = True
    role.deleted_at = datetime.now(timezone.utc)
    role.deleted_by_id = current_user.id
    db.commit()
    return {"message": "Role deleted successfully"}


HIDDEN_PRIVILEGES = {
    "recycle_bin.read",
    "recycle_bin.write",
    "recycle_bin.delete",
    "settings.data_cleanup.read",
    "settings.data_cleanup.write",
}

@router.get("/list_privileges", response_model=list[PrivilegeOut])
def list_privileges(db: Session = Depends(get_db), _: User = Depends(PermissionChecker("users.privileges.read"))):
    return db.query(Privilege).filter(Privilege.status == 1, Privilege.privilege_name.notin_(HIDDEN_PRIVILEGES)).all()


@router.get("/get_role_privileges/{role_id}", response_model=list[int])
def get_role_privileges(
    role_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(AnyPermissionChecker([
        "users.privileges.read",
        "roles.read",
    ])),
):
    role = db.query(Role).filter(Role.id == role_id, Role.is_deleted == False).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    my_rank = current_user.role.rank_level if current_user.role else 99
    if role.rank_level <= my_rank and not current_user.role.is_all_access:
        raise HTTPException(status_code=403, detail="Cannot view privileges of same or higher role")

    privilege_ids = [
        rp.privilege_id
        for rp in db.query(RolePrivilege).filter(
            RolePrivilege.role_id == role_id, RolePrivilege.status == 1
        ).all()
    ]
    return privilege_ids


@router.put("/update_role_privileges/{role_id}")
def update_role_privileges(
    role_id: int,
    payload: RolePrivilegeUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("users.privileges.write")),
):
    role = db.query(Role).filter(Role.id == role_id, Role.is_deleted == False).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    my_rank = current_user.role.rank_level if current_user.role else 99
    target_rank = role.rank_level
    if target_rank <= my_rank:
        raise HTTPException(status_code=403, detail="Cannot modify privileges of same or higher role")

    requested_privileges = (
        db.query(Privilege)
        .options(joinedload(Privilege.module))
        .filter(Privilege.id.in_(payload.privilege_ids), Privilege.status == 1)
        .all()
    )
    requested_ids = {privilege.id for privilege in requested_privileges}
    invalid_ids = set(payload.privilege_ids) - requested_ids
    if invalid_ids:
        raise HTTPException(status_code=400, detail="One or more selected privileges are invalid")

    blocked_privileges = [
        privilege.privilege_name
        for privilege in requested_privileges
        if privilege.module and privilege.module.min_rank_level is not None and target_rank > privilege.module.min_rank_level
    ]
    if blocked_privileges:
        raise HTTPException(
            status_code=403,
            detail=f"Selected role rank cannot access: {', '.join(blocked_privileges)}",
        )

    db.query(RolePrivilege).filter(RolePrivilege.role_id == role_id).delete()

    for priv_id in payload.privilege_ids:
        db.add(RolePrivilege(
            role_id=role_id,
            privilege_id=priv_id,
            status=1,
            created_by=current_user.id,
            updated_by=current_user.id
        ))

    db.commit()
    request.state.audit_meta = {
        "role_name": role.role_name,
        "snapshot": {
            "id": role.id,
            "role_name": role.role_name,
            "rank_level": role.rank_level,
        }
    }
    return {"message": "Privileges updated successfully"}
