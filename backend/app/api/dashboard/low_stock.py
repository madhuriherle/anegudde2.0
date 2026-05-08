from fastapi import APIRouter, Depends
from sqlalchemy import cast, Numeric
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.db.models import Item, User
from app.schemas.dashboard import LowStockRow

router = APIRouter()


@router.get("/get_low_stock", response_model=list[LowStockRow])
def low_stock(
    db: Session = Depends(get_db), 
    _: User = Depends(get_current_user)
):
    rows = (
        db.query(Item)
        .filter(
            Item.min_stock_level.isnot(None), 
            cast(Item.current_stock, Numeric) < Item.min_stock_level
        )
        .order_by(cast(Item.current_stock, Numeric).asc())
        .all()
    )
    return [
        LowStockRow(item_id=r.id, item_name=r.item_name, current_stock=r.current_stock, min_stock_level=r.min_stock_level)
        for r in rows
    ]
