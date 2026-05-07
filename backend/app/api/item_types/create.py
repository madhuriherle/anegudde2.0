from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, get_financial_year
from app.db.models import ItemType, User, FinancialYear
from app.schemas.item_type import ItemTypeCreate, ItemTypeOut

router = APIRouter()


@router.post("/", response_model=ItemTypeOut, status_code=status.HTTP_201_CREATED)
def create_item_type(
    payload: ItemTypeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    financial_year: FinancialYear = Depends(get_financial_year),
):
    exists = db.query(ItemType).filter(ItemType.type_name == payload.type_name).first()
    if exists:
        raise HTTPException(status_code=400, detail="type_name already exists")

    data = payload.model_dump()
    if not data.get("financial_year_id"):
        data["financial_year_id"] = financial_year.id

    now = datetime.now(timezone.utc)
    row = ItemType(
        **data,
        created_at=now,
        updated_at=now,
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row
