from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.db.models import User
from app.utils.tasks import generate_daily_stock_summary

router = APIRouter()


@router.post("/generate-daily-summary")
def trigger_daily_summary(target_date: date = Query(...), db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    generate_daily_stock_summary(target_date)
    return {"message": f"Daily stock summary generated for {target_date}"}
