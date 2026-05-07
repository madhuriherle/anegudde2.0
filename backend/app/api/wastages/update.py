from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user, get_financial_year
from app.db.models import User, FinancialYear
from app.schemas.wastage import WastageEntryFullOut, WastageEntryUpdate
from app.services.wastage_service import update_wastage

router = APIRouter()

@router.put("/update_wastage/{wastage_id}", response_model=WastageEntryFullOut)
def modify_wastage(wastage_id: int, payload: WastageEntryUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), financial_year: FinancialYear = Depends(get_financial_year)):
    return update_wastage(wastage_id, payload, db, current_user, financial_year)
