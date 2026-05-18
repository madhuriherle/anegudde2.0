import math

from fastapi import APIRouter, Depends, Query
from sqlalchemy import String
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.db.models import DonationType, User
from app.schemas.base import PaginatedResponse
from app.schemas.donation_type import DonationTypeOut

router = APIRouter()


@router.get("/list_donation_types", response_model=PaginatedResponse[DonationTypeOut])
def list_donation_types(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=1000),
    q: str | None = Query(None),
    status: int | None = Query(None),
):
    query = db.query(DonationType)
    if status is not None:
        query = query.filter(DonationType.status == status)
    if q:
        like = f"%{q}%"
        query = query.filter(
            DonationType.type_name.ilike(like)
            | DonationType.receipt_prefix.ilike(like)
            | DonationType.id.cast(String).ilike(like)
        )

    total = query.count()
    offset = (page - 1) * page_size
    items = query.order_by(DonationType.status.desc(), DonationType.type_name.asc()).offset(offset).limit(page_size).all()

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": math.ceil(total / page_size) if total > 0 else 0,
    }
