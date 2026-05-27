from datetime import date
import os
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.api.deps import get_db, PermissionChecker
from app.db.models import User
from app.services.receipt_sequence_service import preview_next_donation_receipt
from app.services import donation_service

router = APIRouter()

@router.get("/preview_receipt_number")
def get_preview_receipt_number(
    donation_date: date,
    donation_type_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("donations.read"))
):
    return {"receipt_number": preview_next_donation_receipt(db, donation_date, donation_type_id)}

@router.get("/download_stored_receipt/{donation_id}")
def download_stored_receipt(
    donation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("donations.read"))
):
    donation = donation_service.get_donation(donation_id, db)
    if not donation.receipt_pdf_url:
        # If PDF doesn't exist (e.g. for old records), generate it now
        from app.utils.donation_receipt import generate_and_save_donation_receipt
        pdf_url = generate_and_save_donation_receipt(donation_id, db)
        if pdf_url:
            donation.receipt_pdf_url = pdf_url
            db.commit()
        else:
            raise HTTPException(status_code=404, detail="Receipt PDF not found and could not be generated")
    
    # Strip leading slash
    file_path = donation.receipt_pdf_url.lstrip("/")
    if not os.path.exists(file_path):
         # Try regenerating if file missing on disk
        from app.utils.donation_receipt import generate_and_save_donation_receipt
        pdf_url = generate_and_save_donation_receipt(donation_id, db)
        if pdf_url:
            donation.receipt_pdf_url = pdf_url
            db.commit()
            file_path = pdf_url.lstrip("/")
        else:
            raise HTTPException(status_code=404, detail="Receipt file not found on server")

    filename = f"Receipt_{donation.receipt_display_number or donation.id}.pdf"
    return FileResponse(
        path=file_path,
        filename=filename,
        media_type="application/pdf"
    )
