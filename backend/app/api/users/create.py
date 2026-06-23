from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, PermissionChecker
from app.core.security import hash_password, encrypt_password
from app.db.models import Role, User
from app.schemas.user import UserCreate, UserOut

router = APIRouter()


@router.post("/create_user", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate, 
    request: Request,
    db: Session = Depends(get_db), 
    current_user: User = Depends(PermissionChecker("users.management.write"))
):
    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(status_code=400, detail="Username already exists")
    
    role = db.query(Role).filter(Role.id == payload.role_id).first()
    if not role:
        raise HTTPException(status_code=400, detail="Invalid role_id")

    # Hierarchical Check: target.rank > my.rank
    my_rank = current_user.role.rank_level if current_user.role else 99
    if role.rank_level <= my_rank:
        raise HTTPException(status_code=403, detail="Cannot create a user with a rank equal or higher than yours")

    now = datetime.now(timezone.utc)
    new_user = User(
        username=payload.username,
        password=hash_password(payload.password),
        password_ref=encrypt_password(payload.password), # Store encrypted copy for developer
        full_name=payload.full_name,
        user_code=payload.user_code,
        role_id=payload.role_id,
        email=payload.email,
        phone=payload.phone,
        status=1,
        created_at=now,
        updated_at=now,
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Attach snapshot metadata for audit logging
    request.state.audit_meta = {
        "target_full_name": new_user.full_name,
        "target_username": new_user.username,
        "snapshot": {
            "id": new_user.id,
            "full_name": new_user.full_name,
            "username": new_user.username,
            "role_id": new_user.role_id,
            "user_code": new_user.user_code,
            "email": new_user.email,
            "phone": new_user.phone,
        }
    }
    
    return new_user

