from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user, PermissionChecker
from app.db.models import User
from app.schemas.wastage import WastageEntryFullOut
from app.services.wastage_service import get_wastage_full

router = APIRouter()

@router.get("/get_wastage/{wastage_id}", response_model=WastageEntryFullOut)
def read_wastage(wastage_id: int, db: Session = Depends(get_db), _: User = Depends(PermissionChecker("consumptions.read"))):
    return get_wastage_full(wastage_id, db)
