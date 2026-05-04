from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.core.security import hash_password
from app.db.models import Role, User
from app.schemas.user import UserOut, UserUpdate

router = APIRouter()


@router.put("/{user_id}", response_model=UserOut)
def update_user(user_id: int, payload: UserUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.username != user.username and db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(status_code=400, detail="Username already exists")
    if payload.role_id != user.role_id and not db.query(Role).filter(Role.id == payload.role_id).first():
        raise HTTPException(status_code=400, detail="Invalid role_id")

    user.username = payload.username
    user.full_name = payload.full_name
    user.role_id = payload.role_id
    user.email = payload.email
    user.phone = payload.phone
    if payload.password:
        user.password = hash_password(payload.password)

    user.updated_at = datetime.now(timezone.utc)
    user.updated_by = current_user.id
    db.commit()
    db.refresh(user)
    return user
