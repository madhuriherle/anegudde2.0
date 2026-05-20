from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, PermissionChecker
from app.db.models import User

router = APIRouter()


@router.delete("/delete_user/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(PermissionChecker("users.delete"))):
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # --- SAFETY BLOCK: Last Admin Protection ---
    from app.db.models import Role
    admin_role = db.query(Role).filter(Role.role_name == "Admin").first()
    if target_user.role_id == admin_role.id:
        active_admins = db.query(User).filter(
            User.role_id == admin_role.id, 
            User.status == 1,
            User.id != user_id
        ).count()
        if active_admins == 0:
            raise HTTPException(
                status_code=400, 
                detail="System requires at least one active Administrator. You cannot delete the last Admin."
            )
    # -------------------------------------------
    
    target_user.status = 0
    db.commit()
    return None
