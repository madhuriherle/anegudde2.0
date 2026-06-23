from decimal import Decimal
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.db.models import StockLedger


def compute_current_value(
    db: Session,
    item_id: int,
    value_in: Decimal,
    value_out: Decimal,
) -> Decimal:
    prev_val = db.query(func.coalesce(func.max(StockLedger.current_value), 0)).filter(
        StockLedger.item_id == item_id,
        StockLedger.status == 1,
    ).scalar()
    return Decimal(str(prev_val or 0)) + value_in - value_out
