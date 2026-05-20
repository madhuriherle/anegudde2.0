from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, PermissionChecker
from app.db.models import Role, User, Privilege, RolePrivilege
from app.schemas.user import RoleOut, PrivilegeOut, RolePrivilegeUpdate

router = APIRouter()


@router.get("/list_roles", response_model=list[RoleOut])
def list_roles(db: Session = Depends(get_db), _: User = Depends(PermissionChecker("users.read"))):
    return db.query(Role).all()


@router.get("/list_privileges", response_model=list[PrivilegeOut])
def list_privileges(db: Session = Depends(get_db), _: User = Depends(PermissionChecker("users.read"))):
    return db.query(Privilege).filter(Privilege.status == 1).all()


@router.get("/get_role_privileges/{role_id}", response_model=list[int])
def get_role_privileges(
    role_id: int, 
    db: Session = Depends(get_db), 
    _: User = Depends(PermissionChecker("users.read"))
):
    privs = db.query(RolePrivilege).filter(RolePrivilege.role_id == role_id, RolePrivilege.status == 1).all()
    return [p.privilege_id for p in privs]


@router.put("/update_role_privileges/{role_id}")
def update_role_privileges(
    role_id: int,
    payload: RolePrivilegeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("users.write"))
):
    # Only Super Admin or Temple Trustee can update privileges
    if not current_user.role.is_all_access:
        raise HTTPException(status_code=403, detail="Not authorized to update privileges")

    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    if role.is_all_access:
         raise HTTPException(status_code=400, detail="Cannot modify all-access role privileges")

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
