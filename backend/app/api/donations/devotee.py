from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.api import deps
from app.services import devotee_service
from app.schemas.devotee import DevoteeDetailOut, DevoteeOut
from app.schemas.base import PaginatedResponse

router = APIRouter()

@router.get("/list_devotees", response_model=PaginatedResponse[DevoteeOut])
def list_devotees(
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    q: str = Query(None)
):
    return devotee_service.list_devotees(db, page, page_size, q)

@router.get("/get_devotee/{devotee_id}", response_model=DevoteeDetailOut)
def get_devotee(
    devotee_id: int,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
):
    devotee = devotee_service.get_devotee_details(devotee_id, db)
    if not devotee:
        raise HTTPException(status_code=404, detail="Devotee not found")
    return devotee

@router.get("/get_devotee_by_phone/{phone}", response_model=DevoteeOut)
def get_devotee_by_phone(
    phone: str,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
):
    devotee = devotee_service.get_devotee_by_phone(phone, db)
    if not devotee:
        raise HTTPException(status_code=404, detail="Devotee not found")
    return devotee
