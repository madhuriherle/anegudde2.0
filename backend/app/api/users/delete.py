from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.api.deps import get_db, PermissionChecker
from app.db.models import User

router = APIRouter()

@router.delete("/delete_user/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int, 
    request: Request,
    db: Session = Depends(get_db), 
    current_user: User = Depends(PermissionChecker("users.management.delete"))
):
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    target_user = db.query(User).filter(User.id == user_id, User.is_deleted == False).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Snapshot metadata for audit logging
    request.state.audit_meta = {
        "target_full_name": target_user.full_name,
        "target_username": target_user.username,
        "snapshot": {
            "id": target_user.id,
            "full_name": target_user.full_name,
            "username": target_user.username,
            "role_id": target_user.role_id,
            "user_code": target_user.user_code,
            "email": target_user.email,
            "phone": target_user.phone,
            "status": target_user.status,
        }
    }
        
    # Hierarchical Check: my rank must be strictly better than target rank
    my_rank = current_user.role.rank_level if current_user.role else 99
    target_rank = target_user.role.rank_level if target_user.role else 99
    
    if target_rank <= my_rank:
        raise HTTPException(status_code=403, detail="Unauthorized to delete superior or equal rank users")

    from datetime import datetime, timezone
    target_user.is_deleted = True
    target_user.deleted_at = datetime.now(timezone.utc)
    target_user.deleted_by_id = current_user.id
    db.commit()
    return None
