from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user
from app.db.models import User
from app.schemas.consumption import ConsumptionEntryFullOut
from app.services.consumption_service import get_consumption_full

router = APIRouter()

@router.get("/get_consumption/{consumption_id}", response_model=ConsumptionEntryFullOut)
def read_consumption(consumption_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return get_consumption_full(consumption_id, db)
