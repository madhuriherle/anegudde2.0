from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict


class PurchaseItemIn(BaseModel):
    item_id: int
    quantity: Decimal
    price: Decimal


class PurchaseEntryCreate(BaseModel):
    vendor_id: int
    purchase_date: date
    bill_no: str | None = None
    user_id: int
    status: int = 1
    items: list[PurchaseItemIn]


class PurchaseItemOut(BaseModel):
    id: int
    purchase_entry_id: int
    item_id: int
    quantity: Decimal
    price: Decimal
    line_total: Decimal

    model_config = ConfigDict(from_attributes=True)


class PurchaseEntryOut(BaseModel):
    id: int
    vendor_id: int
    purchase_date: date
    bill_no: str | None = None
    total_amount: Decimal
    user_id: int
    status: int
    created_at: datetime
    updated_at: datetime
    created_by: int | None = None
    updated_by: int | None = None

    model_config = ConfigDict(from_attributes=True)


class PurchaseEntryUpdate(BaseModel):
    vendor_id: int
    purchase_date: date
    bill_no: str | None = None
    items: list[PurchaseItemIn]


class UserMinimal(BaseModel):
    id: int
    username: str
    full_name: str

    model_config = ConfigDict(from_attributes=True)


class PurchaseEntryFullOut(PurchaseEntryOut):
    items: list[PurchaseItemOut]
    user: UserMinimal | None = None
