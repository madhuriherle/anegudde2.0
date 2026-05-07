from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel

class StockAdjustmentBase(BaseModel):
    item_id: int
    adjustment_date: date
    adjusted_qty: Decimal
    financial_year_id: int | None = None
    reason: str | None = None

class StockAdjustmentCreate(StockAdjustmentBase):
    pass

class StockAdjustmentOut(StockAdjustmentBase):
    id: int
    user_id: int
    created_at: datetime

    class Config:
        from_attributes = True
