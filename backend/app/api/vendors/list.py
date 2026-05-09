from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.db.models import User, Vendor
from app.schemas.vendor import VendorOut
from app.schemas.base import PaginatedResponse
import math

router = APIRouter()


@router.get("/list_vendors", response_model=PaginatedResponse[VendorOut])
def list_vendors(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=1000),
    q: str | None = Query(None),
    status: int | None = Query(1),
    search_field: str | None = Query(None),
    sort_by: str = Query("id"),
    sort_order: str = Query("desc"),
):
    query = db.query(Vendor)
    
    if status is not None:
        query = query.filter(Vendor.status == status)

    # Smart Search: Extract dates from q if present
    import re
    from_date, to_date = None, None
    if q:
        # Look for YYYY-MM-DD patterns
        date_patterns = re.findall(r"\d{4}-\d{2}-\d{2}", q)
        if len(date_patterns) >= 2:
            from_date, to_date = date_patterns[0], date_patterns[1]
            q = re.sub(r"\d{4}-\d{2}-\d{2}", "", q).strip()
        elif len(date_patterns) == 1:
            from_date = to_date = date_patterns[0]
            q = re.sub(r"\d{4}-\d{2}-\d{2}", "", q).strip()

    if from_date:
        query = query.filter(Vendor.created_at >= from_date)
    if to_date:
        query = query.filter(Vendor.created_at <= f"{to_date} 23:59:59")

    if q:
        like = f"%{q}%"
        if search_field == "name":
            query = query.filter(Vendor.vendor_name.ilike(like))
        elif search_field == "code":
            query = query.filter(Vendor.vendor_code.ilike(like))
        elif search_field == "contact":
            query = query.filter(Vendor.contact_number.ilike(like))
        elif search_field == "person":
            query = query.filter(Vendor.contact_person.ilike(like))
        elif search_field == "city":
            query = query.filter(Vendor.city.ilike(like))
        else:
            query = query.filter(
                (Vendor.vendor_name.ilike(like)) |
                (Vendor.vendor_code.ilike(like)) |
                (Vendor.contact_number.ilike(like)) |
                (Vendor.contact_person.ilike(like)) |
                (Vendor.city.ilike(like))
            )
    # Default sorting: Status (Active first), then Vendor Name (A-Z)
    if sort_by == "id" and sort_order == "desc":
        query = query.order_by(Vendor.status.desc(), Vendor.vendor_name.asc())
    else:
        sort_col = getattr(Vendor, sort_by, Vendor.id)
        query = query.order_by(sort_col.asc() if sort_order.lower() == "asc" else sort_col.desc())
    
    total = query.count()
    offset = (page - 1) * page_size
    items = query.offset(offset).limit(page_size).all()
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": math.ceil(total / page_size) if total > 0 else 0
    }

