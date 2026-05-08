from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.db.models import PurchaseEntry, User, PurchaseBill

router = APIRouter()

BASE_DIR = Path(__file__).resolve().parents[3]


@router.get("/download_bill/{purchase_id}")
def download_purchase_bill(
    purchase_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    # Get the latest bill for this purchase
    bill = db.query(PurchaseBill).filter(PurchaseBill.purchase_id == purchase_id).order_by(PurchaseBill.created_at.desc()).first()
    
    if not bill or not bill.file_path:
        raise HTTPException(status_code=404, detail="Bill file not found")

    file_path = BASE_DIR / bill.file_path
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="Bill file not found on disk")

    return FileResponse(
        path=str(file_path),
        media_type=bill.file_type or "application/octet-stream",
        filename=bill.file_name or file_path.name,
    )
