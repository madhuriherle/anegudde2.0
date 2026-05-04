from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.core.security import hash_password
from app.db.models import Role, User
from app.schemas.user import UserCreate, UserOut

router = APIRouter()


@router.post("/", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(status_code=400, detail="Username already exists")
    if not db.query(Role).filter(Role.id == payload.role_id).first():
        raise HTTPException(status_code=400, detail="Invalid role_id")

    now = datetime.now(timezone.utc)
    new_user = User(
        username=payload.username,
        password=hash_password(payload.password),
        full_name=payload.full_name,
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
    return new_user

