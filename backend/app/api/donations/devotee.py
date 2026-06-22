from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, PermissionChecker
from app.services import devotee_service
from app.schemas.devotee import DevoteeDetailOut, DevoteeOut
from app.schemas.base import PaginatedResponse
from app.db.models import Devotee

router = APIRouter()

@router.get("/list_devotees", response_model=PaginatedResponse[DevoteeOut])
def list_devotees(
    db: Session = Depends(get_db),
    current_user = Depends(PermissionChecker("donations.read")),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    q: str = Query(None)
):
    return devotee_service.list_devotees(db, page, page_size, q)

@router.get("/get_devotee/{devotee_id}", response_model=DevoteeDetailOut)
def get_devotee(
    devotee_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(PermissionChecker("donations.read"))
):
    devotee = devotee_service.get_devotee_details(devotee_id, db)
    if not devotee:
        raise HTTPException(status_code=404, detail="Devotee not found")
    return devotee

@router.get("/get_devotee_by_phone/{phone}", response_model=DevoteeOut)
def get_devotee_by_phone(
    phone: str,
    db: Session = Depends(get_db),
    current_user = Depends(PermissionChecker("donations.read"))
):
    devotee = devotee_service.get_devotee_by_phone(phone, db)
    if not devotee:
        raise HTTPException(status_code=404, detail="Devotee not found")
    return devotee

@router.delete("/delete_devotee/{devotee_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_devotee(
    devotee_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(PermissionChecker("donations.delete"))
):
    devotee = db.query(Devotee).filter(Devotee.id == devotee_id, Devotee.is_deleted == False).first()
    if not devotee:
        raise HTTPException(status_code=404, detail="Devotee not found")

    request.state.audit_meta = {
        "devotee_name": devotee.devotee_name,
        "phone_number": devotee.phone_number
    }

    from datetime import datetime, timezone
    devotee.is_deleted = True
    devotee.deleted_at = datetime.now(timezone.utc)
    devotee.deleted_by_id = current_user.id
    db.commit()
    return None
