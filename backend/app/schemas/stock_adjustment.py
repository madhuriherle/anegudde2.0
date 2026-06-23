from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel

class StockAdjustmentBase(BaseModel):
    item_id: int
    adjustment_date: date
    adjusted_qty: Decimal
    reason: str | None = None
    consumption_entry_id: int | None = None

class StockAdjustmentCreate(StockAdjustmentBase):
    pass

class StandaloneStockAdjustmentCreate(BaseModel):
    item_id: int
    adjusted_qty: Decimal
    reason: str | None = None

class StockAdjustmentOut(StockAdjustmentBase):
    id: int
    user_id: int
    created_at: datetime
    consumption_entry_id: int | None = None

    class Config:
        from_attributes = True
