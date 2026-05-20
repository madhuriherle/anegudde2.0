from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, get_db, PermissionChecker
from app.db.models import User
from app.schemas.vendor_payment import VendorPaymentCreate, VendorPaymentOut
from app.schemas.base import PaginatedResponse
from app.services import vendor_payment_service

router = APIRouter(prefix="/vendor-payments", tags=["vendor-payments"])

@router.get("/list_vendor_payments", response_model=PaginatedResponse[VendorPaymentOut])
def list_vendor_payments(
    page: int = 1,
    page_size: int = 20,
    q: str | None = Query(None),
    status: int | None = Query(1),
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("vendor_payments.read"))
):
    return vendor_payment_service.list_vendor_payments(db, page, page_size, q, status)


@router.post("/create_vendor_payment", response_model=VendorPaymentOut, status_code=status.HTTP_201_CREATED)
def create_vendor_payment(
    payload: VendorPaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("vendor_payments.write"))
):
    return vendor_payment_service.create_vendor_payment(payload, db, current_user)

@router.delete("/delete_vendor_payment/{payment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_vendor_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("vendor_payments.delete"))
):
    vendor_payment_service.delete_vendor_payment(payment_id, db, current_user)
    return None
