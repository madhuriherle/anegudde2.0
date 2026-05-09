from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, get_db
from app.db.models import Unit, User
from app.schemas.unit import UnitCreate, UnitOut
router = APIRouter()
@router.post("/create_unit", response_model=UnitOut, status_code=status.HTTP_201_CREATED)
def create_unit(
    payload: UnitCreate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    exists = db.query(Unit).filter(Unit.unit_code == payload.unit_code).first()
    if exists:
        raise HTTPException(status_code=400, detail="unit_code already exists")
    
    data = payload.model_dump()

    now = datetime.now(timezone.utc)
    row = Unit(**data, created_at=now, updated_at=now, created_by=current_user.id, updated_by=current_user.id)
    db.add(row); db.commit(); db.refresh(row)
    return row
