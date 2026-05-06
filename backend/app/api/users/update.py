from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.core.security import hash_password
from app.db.models import Role, User
from app.schemas.user import UserOut, UserUpdate

router = APIRouter()


@router.put("/update_user/{user_id}", response_model=UserOut)
def update_user(user_id: int, payload: UserUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.username is not None and payload.username != user.username:
        if db.query(User).filter(User.username == payload.username).first():
            raise HTTPException(status_code=400, detail="Username already exists")

    if payload.role_id is not None and payload.role_id != user.role_id:
        if not db.query(Role).filter(Role.id == payload.role_id).first():
            raise HTTPException(status_code=400, detail="Invalid role_id")

    if payload.username is not None:
        user.username = payload.username
    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.role_id is not None:
        user.role_id = payload.role_id
    if payload.email is not None:
        user.email = payload.email
    if payload.phone is not None:
        user.phone = payload.phone
    if payload.status is not None:
        user.status = payload.status
    if payload.password:
        user.password = hash_password(payload.password)

    user.updated_at = datetime.now(timezone.utc)
    user.updated_by = current_user.id
    db.commit()
    db.refresh(user)
    return user
