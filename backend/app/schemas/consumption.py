from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict


class ConsumptionItemIn(BaseModel):
    item_id: int
    quantity_used: Decimal
    unit_cost_at_time: Decimal | None = None


class ConsumptionEntryCreate(BaseModel):
    usage_date: date
    people_served: int | None = None
    chef_id: int | None = None
    user_id: int
    status: int = 1
    items: list[ConsumptionItemIn]


class ConsumptionEntryOut(BaseModel):
    id: int
    usage_date: date
    people_served: int | None = None
    chef_id: int | None = None
    user_id: int
    status: int
    created_at: datetime
    updated_at: datetime
    created_by: int | None = None
    updated_by: int | None = None

    model_config = ConfigDict(from_attributes=True)


class ConsumptionItemOut(BaseModel):
    id: int
    consumption_entry_id: int
    item_id: int
    quantity_used: Decimal
    unit_cost_at_time: Decimal | None = None
    line_total: Decimal

    model_config = ConfigDict(from_attributes=True)


class ConsumptionEntryUpdate(BaseModel):
    usage_date: date
    people_served: int | None = None
    chef_id: int | None = None
    items: list[ConsumptionItemIn]


class UserMinimal(BaseModel):
    id: int
    username: str
    full_name: str

    model_config = ConfigDict(from_attributes=True)


class ConsumptionEntryFullOut(ConsumptionEntryOut):
    items: list[ConsumptionItemOut]
    user: UserMinimal | None = None
