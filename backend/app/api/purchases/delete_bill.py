from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, PermissionChecker
from app.db.models import PurchaseEntry, PurchaseBill, User

router = APIRouter()

BASE_DIR = Path(__file__).resolve().parents[3]


@router.delete("/delete_bill/{purchase_id}")
def delete_purchase_bill(
    request: Request,
    purchase_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(PermissionChecker("purchases.delete")),
):
    entry = db.query(PurchaseEntry).filter(PurchaseEntry.id == purchase_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Purchase not found")

    bill = (
        db.query(PurchaseBill)
        .filter(PurchaseBill.purchase_id == purchase_id)
        .order_by(PurchaseBill.created_at.desc())
        .first()
    )
    if not bill:
        raise HTTPException(status_code=404, detail="No bill attachment found")

    request.state.audit_meta = {
        "snapshot": {
            "purchase_id": purchase_id,
            "bill_id": bill.id,
            "file_name": bill.file_name,
            "bill_no": entry.bill_no,
            "vendor_name": entry.vendor_name,
        }
    }

    file_path = BASE_DIR / (bill.file_path or "")
    if bill.file_path and file_path.exists() and file_path.is_file():
        try:
            file_path.unlink()
        except Exception:
            pass

    db.delete(bill)
    db.commit()
    return {"message": "Bill attachment removed"}

