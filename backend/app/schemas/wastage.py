from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict
from app.schemas.menu_item import MenuItemOut


class WastageItemIn(BaseModel):
    menu_item_id: int
    quantity: Decimal


class WastageEntryCreate(BaseModel):
    wastage_date: date
    reason: str | None = None
    financial_year_id: int | None = None
    user_id: int | None = None
    status: int = 1
    items: list[WastageItemIn]


class WastageEntryOut(BaseModel):
    id: int
    wastage_date: date
    reason: str | None = None
    financial_year_id: int | None = None
    user_id: int
    status: int
    created_at: datetime
    updated_at: datetime
    created_by: int | None = None
    updated_by: int | None = None

    model_config = ConfigDict(from_attributes=True)


class WastageItemOut(BaseModel):
    id: int
    wastage_entry_id: int
    menu_item_id: int
    quantity: Decimal
    menu_item: MenuItemOut | None = None

    model_config = ConfigDict(from_attributes=True)


class WastageEntryUpdate(BaseModel):
    wastage_date: date
    reason: str | None = None
    financial_year_id: int | None = None
    items: list[WastageItemIn]


class UserMinimal(BaseModel):
    id: int
    username: str
    full_name: str

    model_config = ConfigDict(from_attributes=True)


class WastageEntryFullOut(WastageEntryOut):
    items: list[WastageItemOut]
    user: UserMinimal | None = None
