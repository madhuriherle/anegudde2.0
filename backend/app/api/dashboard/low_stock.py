from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.db.models import Item, User
from app.schemas.dashboard import LowStockRow

router = APIRouter()


@router.get("/low-stock", response_model=list[LowStockRow])
def low_stock(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    rows = (
        db.query(Item)
        .filter(Item.min_stock_level.isnot(None), Item.current_stock < Item.min_stock_level)
        .order_by(Item.current_stock.asc())
        .all()
    )
    return [
        LowStockRow(item_id=r.id, item_name=r.item_name, current_stock=r.current_stock, min_stock_level=r.min_stock_level)
        for r in rows
    ]
