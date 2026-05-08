from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, get_db, get_financial_year
from app.db.models import User, FinancialYear
from app.schemas.vendor_payment import VendorPaymentCreate, VendorPaymentOut
from app.schemas.base import PaginatedResponse
from app.services import vendor_payment_service

router = APIRouter(prefix="/vendor-payments", tags=["vendor-payments"])

@router.get("/list_vendor_payments", response_model=PaginatedResponse[VendorOut])
def list_vendor_payments(
    page: int = 1,
    page_size: int = 20,
    q: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return vendor_payment_service.list_vendor_payments(db, page, page_size, q)


@router.post("/create_vendor_payment", response_model=VendorPaymentOut, status_code=status.HTTP_201_CREATED)
def create_vendor_payment(
    payload: VendorPaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    financial_year: FinancialYear = Depends(get_financial_year)
):
    return vendor_payment_service.create_vendor_payment(payload, db, current_user, financial_year)

@router.delete("/delete_vendor_payment/{payment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_vendor_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    vendor_payment_service.delete_vendor_payment(payment_id, db, current_user)
    return None
