from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user
from app.db.models import Chef, User
from app.schemas.chef import ChefCreate, ChefOut

router = APIRouter()

@router.post("/", response_model=ChefOut)
def create_chef(
    *,
    db: Session = Depends(get_db),
    chef_in: ChefCreate,
    current_user: User = Depends(get_current_user)
):
    now = datetime.now(timezone.utc)
    chef = Chef(
        chef_name=chef_in.chef_name,
        phone=chef_in.phone,
        user_id=chef_in.user_id,
        status=chef_in.status,
        created_at=now,
        updated_at=now,
        created_by=current_user.id,
        updated_by=current_user.id
    )
    db.add(chef)
    db.commit()
    db.refresh(chef)
    return chef
