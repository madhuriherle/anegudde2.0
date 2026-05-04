from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel

class StockLedgerOut(BaseModel):
    id: int
    txn_date: date
    txn_type: int
    ref_table: str
    ref_id: int
    qty_in: Decimal
    qty_out: Decimal
    unit_cost: Decimal
    balance: Decimal
    created_at: datetime

    class Config:
        from_attributes = True
