from datetime import date
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app.services.receipt_sequence_service import preview_next_donation_receipt

router = APIRouter()

@router.get("/preview_receipt_number")
def get_preview_receipt_number(
    donation_date: date,
    donation_type_id: int,
    db: Session = Depends(get_db)
):
    return {"receipt_number": preview_next_donation_receipt(db, donation_date, donation_type_id)}
