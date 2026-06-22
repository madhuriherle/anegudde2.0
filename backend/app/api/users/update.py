import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.api.deps import get_db, PermissionChecker
from app.core.security import hash_password, encrypt_password
from app.db.models import Role, User
from app.schemas.user import UserOut, UserUpdate

router = APIRouter()

@router.put("/update_user/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    payload: UserUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("users.management.write"))
):
    user = db.query(User).filter(User.id == user_id, User.is_deleted == False).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Audit meta
    request.state.audit_meta = {
        "target_full_name": user.full_name,
        "target_username": user.username
    }

    # Hierarchical Check: my rank must be strictly better than target rank
    my_rank = current_user.role.rank_level if current_user.role else 99
    target_rank = user.role.rank_level if user.role else 99
    
    if target_rank <= my_rank and user.id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized to modify superior or equal rank users")

    needs_reauth = False

    if payload.username is not None and payload.username != user.username:
        if db.query(User).filter(User.username == payload.username).first():
            raise HTTPException(status_code=400, detail="Username already exists")
        needs_reauth = True
        user.username = payload.username

    if payload.role_id is not None and payload.role_id != user.role_id:
        new_role = db.query(Role).filter(Role.id == payload.role_id).first()
        if not new_role:
            raise HTTPException(status_code=400, detail="Invalid role_id")
        
        # Can only assign roles strictly lower than mine
        if new_role.rank_level <= my_rank:
             raise HTTPException(status_code=403, detail="Cannot assign a rank equal or higher than yours")
        
        user.role_id = payload.role_id
        needs_reauth = True

    if payload.full_name is not None:
        if payload.full_name != user.full_name:
            needs_reauth = True
        user.full_name = payload.full_name
    
    if payload.user_code is not None:
        if payload.user_code != user.user_code:
            needs_reauth = True
        user.user_code = payload.user_code
    
    if payload.email is not None:
        if payload.email != user.email:
            needs_reauth = True
        user.email = payload.email
    
    if payload.phone is not None:
        if payload.phone != user.phone:
            needs_reauth = True
        user.phone = payload.phone
    
    if payload.status is not None:
        if user.status != payload.status:
            needs_reauth = True
        user.status = payload.status
    
    if payload.password:
        user.password = hash_password(payload.password)
        user.password_ref = encrypt_password(payload.password) # Refresh encrypted reference
        needs_reauth = True

    if needs_reauth:
        user.security_stamp = str(uuid.uuid4())

    user.updated_at = datetime.now(timezone.utc)
    user.updated_by = current_user.id
    db.commit()
    db.refresh(user)
    return user
