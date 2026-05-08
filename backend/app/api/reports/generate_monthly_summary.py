from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.db.models import User
from app.utils.tasks import generate_monthly_stock_summary

router = APIRouter()


@router.post("/generate_monthly_summary")
def trigger_monthly_summary(target_month: date = Query(...), db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    generate_monthly_stock_summary(target_month)
    return {"message": f"Monthly stock summary generated for {target_month.strftime('%Y-%m')}"}
