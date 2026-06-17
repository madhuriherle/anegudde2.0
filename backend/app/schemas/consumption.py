from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict
from .base import UTCBaseModel


class ConsumptionItemIn(BaseModel):
    item_id: int
    quantity_used: Decimal
    qty_returned: Decimal = Decimal("0")
    unit_cost_at_time: Decimal | None = None


class ConsumptionEntryCreate(BaseModel):
    usage_date: date
    people_served: int | None = None
    remarks: str | None = None
    regular_cooking_persons: int = 0
    additional_cooking_persons: int = 0
    regular_cleaning_persons: int = 0
    additional_cleaning_persons: int = 0
    regular_serving_persons: int = 0
    additional_serving_persons: int = 0
    times_cooked: int = 0
    user_id: int
    status: int = 1
    items: list[ConsumptionItemIn] = []


class ConsumptionEntryOut(UTCBaseModel):
    id: int
    usage_date: date
    people_served: int | None = None
    remarks: str | None = None
    regular_cooking_persons: int = 0
    additional_cooking_persons: int = 0
    regular_cleaning_persons: int = 0
    additional_cleaning_persons: int = 0
    regular_serving_persons: int = 0
    additional_serving_persons: int = 0
    times_cooked: int = 0
    user_id: int
    status: int
    created_at: datetime
    updated_at: datetime
    created_by: int | None = None
    updated_by: int | None = None


class ConsumptionItemOut(UTCBaseModel):
    id: int
    consumption_entry_id: int
    item_id: int
    quantity_used: Decimal
    qty_returned: Decimal
    net_quantity: Decimal
    unit_cost_at_time: Decimal | None = None
    line_total: Decimal


class ConsumptionEntryUpdate(BaseModel):
    usage_date: date
    people_served: int | None = None
    remarks: str | None = None
    regular_cooking_persons: int = 0
    additional_cooking_persons: int = 0
    regular_cleaning_persons: int = 0
    additional_cleaning_persons: int = 0
    regular_serving_persons: int = 0
    additional_serving_persons: int = 0
    times_cooked: int = 0
    items: list[ConsumptionItemIn] = []


class UserMinimal(UTCBaseModel):
    id: int
    username: str
    full_name: str


class ConsumptionEntryFullOut(ConsumptionEntryOut):
    items: list[ConsumptionItemOut]
    user: UserMinimal | None = None

ConsumptionEntryCreate.model_rebuild()
ConsumptionEntryOut.model_rebuild()
ConsumptionItemOut.model_rebuild()
ConsumptionEntryUpdate.model_rebuild()
ConsumptionEntryFullOut.model_rebuild()
