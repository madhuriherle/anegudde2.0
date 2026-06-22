import math

from fastapi import APIRouter, Depends, Query
from sqlalchemy import String, or_
from sqlalchemy.orm import Session

from app.api.deps import get_db, AnyPermissionChecker
from app.db.models import DonationType, User
from app.schemas.donation_type import DonationTypeOut
from app.schemas.base import PaginatedResponse

router = APIRouter()

@router.get("/list_donation_types", response_model=PaginatedResponse[DonationTypeOut])
def list_donation_types(
    db: Session = Depends(get_db),
    _: User = Depends(AnyPermissionChecker(["donation_types.read", "donations.write", "donations.read"])),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=1000),
    q: str = Query(None),
    status: int = Query(None),
    module_id: int = Query(None)
):
    offset = (page - 1) * page_size
    query = db.query(DonationType).filter(DonationType.is_deleted == False)

    if q:
        query = query.filter(DonationType.type_name.ilike(f"%{q}%"))

    if status is not None:
        query = query.filter(DonationType.status == status)

    if module_id is not None:
        # Show types with no module assigned (global/full access)
        # OR types specifically assigned to this exact module
        query = query.filter(
            or_(
                ~DonationType.modules.any(),           # no module = global, shown everywhere
                DonationType.modules.any(id=module_id) # assigned to this specific module only
            )
        )

    total = query.count()
    items = query.order_by(DonationType.status.desc(), DonationType.type_name.asc()).offset(offset).limit(page_size).all()

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": math.ceil(total / page_size) if total > 0 else 0,
    }
