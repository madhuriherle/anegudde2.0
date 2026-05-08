import os
import uuid
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.db.models import PurchaseEntry, User, PurchaseBill

router = APIRouter()

BASE_DIR = Path(__file__).resolve().parents[3]


@router.post("/upload_bill/{purchase_id}")
async def upload_purchase_bill(
    purchase_id: int,
    bill_file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    print(f"DEBUG: upload_purchase_bill called for purchase_id={purchase_id}, filename={bill_file.filename}")
    try:
        entry = db.query(PurchaseEntry).filter(PurchaseEntry.id == purchase_id).first()
        if not entry:
            raise HTTPException(status_code=404, detail="Purchase not found")

        # Create hierarchical folder: uploads/purchase_bills/YYYY/MM
        now = datetime.now()
        year = now.strftime("%Y")
        month = now.strftime("%m")
        
        rel_dir = Path("uploads") / "purchase_bills" / year / month
        abs_dir = BASE_DIR / rel_dir
        abs_dir.mkdir(parents=True, exist_ok=True)

        ext = Path(bill_file.filename or "").suffix
        safe_name = f"{purchase_id}_{uuid.uuid4().hex}{ext}"
        abs_path = abs_dir / safe_name

        content = await bill_file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Uploaded file is empty")
        with open(abs_path, "wb") as f:
            f.write(content)

        rel_path = f"uploads/purchase_bills/{year}/{month}/{safe_name}"
        
        # Save to PurchaseBill table
        print(f"DEBUG: Saving to purchase_bills table: purchase_id={purchase_id}, rel_path={rel_path}")
        new_bill = PurchaseBill(
            purchase_id=purchase_id,
            file_name=bill_file.filename or safe_name,
            file_path=rel_path,
            file_type=bill_file.content_type
        )
        db.add(new_bill)
        db.commit()
        db.refresh(new_bill)
        print(f"DEBUG: Successfully saved bill with id={new_bill.id}")

        return {
            "message": "Bill uploaded",
            "id": new_bill.id,
            "file_name": new_bill.file_name,
            "file_path": new_bill.file_path,
            "file_type": new_bill.file_type,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Bill upload failed: {str(e)}")
