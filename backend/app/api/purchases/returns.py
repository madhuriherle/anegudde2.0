from fastapi import APIRouter, Depends, Query, status, Request
from sqlalchemy.orm import Session, joinedload
from app.api.deps import get_current_user, get_db, PermissionChecker
from app.db.models import User, PurchaseReturnEntry
from app.schemas.purchase_return import PurchaseReturnEntryCreate, PurchaseReturnEntryOut
from app.services import purchase_return_service
from app.schemas.base import PaginatedResponse

router = APIRouter()

@router.get("/list_returns", response_model=PaginatedResponse[PurchaseReturnEntryOut])
def list_returns(
    db: Session = Depends(get_db),
    _: User = Depends(PermissionChecker("purchase_returns.read")),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    q: str = Query(None),
    vendor_id: int = Query(None)
):
    return purchase_return_service.list_purchase_returns(db, page, page_size, q, vendor_id)

@router.post("/create_return", response_model=PurchaseReturnEntryOut)
def create_return(
    payload: PurchaseReturnEntryCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("purchase_returns.write"))
):
    entry = purchase_return_service.create_purchase_return(payload, db, current_user)
    
    # Attach snapshot metadata for audit logging
    request.state.audit_meta = {
        "vendor_name": entry.vendor.vendor_name if entry.vendor else None,
        "bill_no": entry.purchase_entry.bill_no if entry.purchase_entry else None,
        "return_date": entry.return_date.isoformat() if entry.return_date else None
    }
    
    return entry


@router.put("/update_return/{return_id}", response_model=PurchaseReturnEntryOut)
def update_return(
    return_id: int,
    payload: PurchaseReturnEntryCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("purchase_returns.write"))
):
    entry = purchase_return_service.update_purchase_return(return_id, payload, db, current_user)
    
    # Attach snapshot metadata for audit logging
    request.state.audit_meta = {
        "vendor_name": entry.vendor.vendor_name if entry.vendor else None,
        "bill_no": entry.purchase_entry.bill_no if entry.purchase_entry else None,
        "return_date": entry.return_date.isoformat() if entry.return_date else None
    }
    
    return entry


@router.delete("/delete_return/{return_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_return(
    return_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("purchase_returns.delete"))
):
    # Fetch details before deletion for snapshot
    entry = (
        db.query(PurchaseReturnEntry)
        .options(joinedload(PurchaseReturnEntry.vendor), joinedload(PurchaseReturnEntry.purchase_entry))
        .filter(PurchaseReturnEntry.id == return_id)
        .first()
    )
    if entry:
        request.state.audit_meta = {
            "vendor_name": entry.vendor.vendor_name if entry.vendor else None,
            "bill_no": entry.purchase_entry.bill_no if entry.purchase_entry else None,
            "return_date": entry.return_date.isoformat() if entry.return_date else None
        }

    purchase_return_service.delete_purchase_return(return_id, db, current_user)
    return None

@router.get("/list_vendor_bills/{vendor_id}")
def get_vendor_bills(vendor_id: int, db: Session = Depends(get_db), _: User = Depends(PermissionChecker("purchase_returns.read"))):
    bills = purchase_return_service.get_vendor_bills(vendor_id, db)
    return [{"id": b.id, "bill_no": b.bill_no, "purchase_date": b.purchase_date, "total_amount": b.total_amount} for b in bills]

@router.get("/vendor_bills/{vendor_id}")
def get_vendor_bills_legacy(vendor_id: int, db: Session = Depends(get_db), _: User = Depends(PermissionChecker("purchase_returns.read"))):
    return get_vendor_bills(vendor_id, db, _)

@router.get("/list_bill_items/{purchase_id}")
def get_bill_items(purchase_id: int, db: Session = Depends(get_db), _: User = Depends(PermissionChecker("purchase_returns.read"))):
    items = purchase_return_service.get_bill_items(purchase_id, db)
    return [
        {
            "item_id": i.item_id,
            "item_name": i.item.item_name,
            "quantity": i.quantity,
            "price": i.price,
            "unit_name": i.item.unit.unit_name if i.item.unit else ""
        }
        for i in items
    ]

@router.get("/bill_items/{purchase_id}")
def get_bill_items_legacy(purchase_id: int, db: Session = Depends(get_db), _: User = Depends(PermissionChecker("purchase_returns.read"))):
    return get_bill_items(purchase_id, db, _)
