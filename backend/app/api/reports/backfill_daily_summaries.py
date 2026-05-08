from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.db.models import User
from app.utils.tasks import generate_daily_stock_summary

router = APIRouter()


@router.post("/backfill_daily_summaries")
def backfill_daily_summaries(from_date: date = Query(...), to_date: date = Query(...), db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    current_date = from_date
    while current_date <= to_date:
        generate_daily_stock_summary(current_date)
        current_date += timedelta(days=1)
    return {"message": f"Daily stock summaries backfilled from {from_date} to {to_date}"}
