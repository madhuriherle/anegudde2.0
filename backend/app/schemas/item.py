from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict


class ItemBase(BaseModel):
    item_name: str
    category_id: int
    unit_id: int
    financial_year_id: int | None = None
    opening_stock: str = "0"
    current_stock: str = "0"
    default_price: Decimal | None = None
    min_stock_level: Decimal | None = None
    max_stock_level: Decimal | None = None
    status: int = 1


class ItemCreate(ItemBase):
    pass


class ItemUpdate(BaseModel):
    item_name: str | None = None
    category_id: int | None = None
    unit_id: int | None = None
    financial_year_id: int | None = None
    opening_stock: str | None = None
    current_stock: str | None = None
    default_price: Decimal | None = None
    min_stock_level: Decimal | None = None
    max_stock_level: Decimal | None = None
    status: int | None = None


class ItemOut(ItemBase):
    id: int
    created_at: datetime
    updated_at: datetime
    created_by: int | None = None
    updated_by: int | None = None

    model_config = ConfigDict(from_attributes=True)
