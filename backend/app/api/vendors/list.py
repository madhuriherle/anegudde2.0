from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.db.models import User, Vendor
from app.schemas.vendor import VendorOut

router = APIRouter()


@router.get("/list_vendors", response_model=list[VendorOut])
def list_vendors(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=1000),
    q: str | None = Query(None),
    status: int | None = Query(None),
    search_field: str | None = Query(None),
    from_date: str | None = Query(None),
    to_date: str | None = Query(None),
    sort_by: str = Query("id"),
    sort_order: str = Query("desc"),
):
    query = db.query(Vendor)
    
    if status is not None:
        query = query.filter(Vendor.status == status)

    if from_date:
        query = query.filter(Vendor.created_at >= from_date)
    if to_date:
        # Append 23:59:59 to to_date to include the entire day
        query = query.filter(Vendor.created_at <= f"{to_date} 23:59:59")

    if q:
        like = f"%{q}%"
        if search_field == "name":
            query = query.filter(Vendor.vendor_name.ilike(like))
        elif search_field == "code":
            query = query.filter(Vendor.vendor_code.ilike(like))
        elif search_field == "contact":
            query = query.filter(Vendor.contact_number.ilike(like))
        elif search_field == "gst":
            query = query.filter(Vendor.gst_number.ilike(like))
        elif search_field == "city":
            query = query.filter(Vendor.city.ilike(like))
        else:
            query = query.filter(
                (Vendor.vendor_name.ilike(like)) | 
                (Vendor.vendor_code.ilike(like)) | 
                (Vendor.contact_number.ilike(like)) |
                (Vendor.gst_number.ilike(like)) |
                (Vendor.city.ilike(like))
            )

    sort_col = getattr(Vendor, sort_by, Vendor.id)
    query = query.order_by(sort_col.asc() if sort_order.lower() == "asc" else sort_col.desc())
    offset = (page - 1) * page_size
    return query.offset(offset).limit(page_size).all()

