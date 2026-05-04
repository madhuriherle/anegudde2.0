from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict


class WastageItemIn(BaseModel):
    item_id: int
    quantity: Decimal
    unit_cost_at_time: Decimal | None = None


class WastageEntryCreate(BaseModel):
    wastage_date: date
    reason: str | None = None
    user_id: int
    status: int = 1
    items: list[WastageItemIn]


class WastageEntryOut(BaseModel):
    id: int
    wastage_date: date
    reason: str | None = None
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
    item_id: int
    quantity: Decimal
    unit_cost_at_time: Decimal | None = None
    line_total: Decimal

    model_config = ConfigDict(from_attributes=True)


class WastageEntryUpdate(BaseModel):
    wastage_date: date
    reason: str | None = None
    items: list[WastageItemIn]


class UserMinimal(BaseModel):
    id: int
    username: str
    full_name: str

    model_config = ConfigDict(from_attributes=True)


class WastageEntryFullOut(WastageEntryOut):
    items: list[WastageItemOut]
    user: UserMinimal | None = None
