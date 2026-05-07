from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user, get_financial_year
from app.db.models import MenuItem, User, FinancialYear
from app.schemas.menu_item import MenuItemCreate, MenuItemOut

router = APIRouter()

@router.post("/create_menu_item", response_model=MenuItemOut, status_code=status.HTTP_201_CREATED)
def create_menu_item(
    payload: MenuItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    financial_year: FinancialYear = Depends(get_financial_year)
):
    # Check for duplicate dish name
    existing = db.query(MenuItem).filter(MenuItem.dish_name.ilike(payload.dish_name)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Dish name already exists")

    data = payload.model_dump()
    if not data.get("financial_year_id"):
        data["financial_year_id"] = financial_year.id

    now = datetime.now(timezone.utc)
    db_item = MenuItem(
        **data,
        created_at=now,
        updated_at=now,
        created_by=current_user.id,
        updated_by=current_user.id
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item
