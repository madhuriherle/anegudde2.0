from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user
from app.db.models import User
from app.schemas.consumption import ConsumptionEntryFullOut, ConsumptionEntryUpdate
from app.services.consumption_service import update_consumption

router = APIRouter()

@router.put("/{consumption_id}", response_model=ConsumptionEntryFullOut)
def modify_consumption(consumption_id: int, payload: ConsumptionEntryUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return update_consumption(consumption_id, payload, db, current_user)
