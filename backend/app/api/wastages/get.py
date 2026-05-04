from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user
from app.db.models import User
from app.schemas.wastage import WastageEntryFullOut
from app.services.wastage_service import get_wastage_full

router = APIRouter()

@router.get("/{wastage_id}", response_model=WastageEntryFullOut)
def read_wastage(wastage_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return get_wastage_full(wastage_id, db)
