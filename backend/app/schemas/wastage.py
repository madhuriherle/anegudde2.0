from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict
from .base import UTCBaseModel
from app.schemas.unit import UnitOut

class MenuItemMinimal(UTCBaseModel):
    id: int
    dish_name: str
    unit: UnitOut | None = None

class ItemMinimal(UTCBaseModel):
    id: int
    item_name: str
    unit: UnitOut | None = None

class WastageItemIn(BaseModel):
    menu_item_id: int | None = None
    item_id: int | None = None
    quantity: Decimal
    approx_amount: Decimal = Decimal("0")


class WastageEntryCreate(BaseModel):
    wastage_date: date
    times_cooked: int = 0
    consumption_entry_id: int | None = None
    user_id: int
    status: int = 1
    items: list[WastageItemIn] = []


class WastageEntryOut(UTCBaseModel):
    id: int
    wastage_date: date
    times_cooked: int
    consumption_entry_id: int | None = None
    user_id: int
    status: int
    created_at: datetime
    updated_at: datetime
    created_by: int | None = None
    updated_by: int | None = None


class WastageItemOut(UTCBaseModel):
    id: int
    wastage_entry_id: int
    wastage_date: date
    menu_item_id: int | None = None
    item_id: int | None = None
    quantity: Decimal
    approx_amount: Decimal
    menu_item: MenuItemMinimal | None = None
    item: ItemMinimal | None = None


class WastageEntryUpdate(BaseModel):
    wastage_date: date
    times_cooked: int = 0
    consumption_entry_id: int | None = None
    items: list[WastageItemIn] = []

class UserMinimal(UTCBaseModel):
    id: int
    username: str
    full_name: str


class WastageEntryFullOut(WastageEntryOut):
    items: list[WastageItemOut]
    user: UserMinimal | None = None

WastageEntryCreate.model_rebuild()
WastageEntryOut.model_rebuild()
WastageItemOut.model_rebuild()
WastageEntryUpdate.model_rebuild()
WastageEntryFullOut.model_rebuild()
