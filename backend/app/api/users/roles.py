from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user, get_db, PermissionChecker
from app.db.models import Role, User, Privilege, RolePrivilege
from app.schemas.user import RoleOut, PrivilegeOut, RolePrivilegeUpdate

router = APIRouter()


@router.get("/list_roles", response_model=list[RoleOut])
def list_roles(db: Session = Depends(get_db), current_user: User = Depends(PermissionChecker("users.privileges.read"))):
    # 1. Permission check
    # Let's assume anyone with users.privileges.read can list roles, but they only see lower ranks
    
    my_rank = current_user.role.rank_level if current_user.role else 99
    
    # Show only roles with rank strictly greater than mine (weaker roles)
    return db.query(Role).filter(Role.rank_level > my_rank).all()


@router.get("/list_privileges", response_model=list[PrivilegeOut])
def list_privileges(db: Session = Depends(get_db), _: User = Depends(PermissionChecker("users.privileges.read"))):
    return db.query(Privilege).filter(Privilege.status == 1).all()


@router.get("/get_role_privileges/{role_id}", response_model=list[int])
def get_role_privileges(
    role_id: int, 
    db: Session = Depends(get_db), 
    _: User = Depends(PermissionChecker("users.privileges.read"))
):
    privs = db.query(RolePrivilege).filter(RolePrivilege.role_id == role_id, RolePrivilege.status == 1).all()
    return [p.privilege_id for p in privs]


@router.put("/update_role_privileges/{role_id}")
def update_role_privileges(
    role_id: int,
    payload: RolePrivilegeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("users.privileges.write"))
):
    # Only all-access roles can update privileges
    if not current_user.role.is_all_access:
        raise HTTPException(status_code=403, detail="Not authorized to update privileges")

    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    my_rank = current_user.role.rank_level if current_user.role else 99
    target_rank = role.rank_level if role else 99

    # Can only modify weaker roles (higher rank number), never same or stronger role
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

    # Remove existing privileges
    db.query(RolePrivilege).filter(RolePrivilege.role_id == role_id).delete()
    
    # Add new privileges
    for priv_id in payload.privilege_ids:
        db.add(RolePrivilege(
            role_id=role_id,
            privilege_id=priv_id,
            status=1,
            created_by=current_user.id,
            updated_by=current_user.id
        ))
    
    db.commit()
    return {"message": "Privileges updated successfully"}
