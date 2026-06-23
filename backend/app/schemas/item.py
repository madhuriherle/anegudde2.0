from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict


from .unit import UnitOut

class ItemCategoryRef(BaseModel):
    id: int
    type_id: int
    category_name: str
    status: int

    model_config = ConfigDict(from_attributes=True)


class ItemBase(BaseModel):
    item_name: str
    display_order: int | None = None
    category_id: int | None = None
    unit_id: int
    opening_stock: Decimal = Decimal("0")
    opening_price: Decimal | None = None
    current_stock: Decimal = Decimal("0")
    default_price: Decimal | None = None
    min_stock_level: Decimal | None = None
    max_stock_level: Decimal | None = None
    status: int = 1


class ItemCreate(ItemBase):
    serial_number: str | None = None


class ItemUpdate(BaseModel):
    item_name: str | None = None
    category_id: int | None = None
    unit_id: int | None = None
    opening_stock: Decimal | None = None
    current_stock: Decimal | None = None
    default_price: Decimal | None = None
    min_stock_level: Decimal | None = None
    max_stock_level: Decimal | None = None
    status: int | None = None
    serial_number: str | None = None


class ItemSerialNumberBase(BaseModel):
    serial_number: str
    status: int = 1


class ItemSerialNumberCreate(ItemSerialNumberBase):
    item_id: int


class ItemSerialNumberOut(ItemSerialNumberBase):
    id: int
    item_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ItemOut(ItemBase):
    id: int
    created_at: datetime
    updated_at: datetime
    created_by: int | None = None
    updated_by: int | None = None
    serial_numbers: list[ItemSerialNumberOut] = []
    category: ItemCategoryRef | None = None
    unit: UnitOut | None = None

    model_config = ConfigDict(from_attributes=True)

ItemCreate.model_rebuild()
ItemUpdate.model_rebuild()
ItemCategoryRef.model_rebuild()
ItemOut.model_rebuild()
