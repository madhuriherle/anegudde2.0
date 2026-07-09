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
    last_ledger = db.query(StockLedger.current_value).filter(
        StockLedger.item_id == item_id,
        StockLedger.status == 1,
    ).order_by(StockLedger.id.desc()).first()
    prev_val = last_ledger[0] if last_ledger else Decimal("0")
    return Decimal(str(prev_val or 0)) + value_in - value_out
