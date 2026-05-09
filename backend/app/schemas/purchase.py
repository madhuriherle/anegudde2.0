from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, field_validator


class PurchaseItemIn(BaseModel):
    item_id: int
    quantity: Decimal
    price: Decimal


class PurchaseBillOut(BaseModel):
    id: int
    purchase_id: int
    file_name: str
    file_path: str
    file_type: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PurchaseEntryCreate(BaseModel):
    vendor_id: int
    purchase_date: date
    bill_no: str | None = None # Invoice/Bill Number
    invoice_amount: Decimal | None = None # Actual invoice total
    user_id: int
    status: int = 1
    items: list[PurchaseItemIn]

    @field_validator("invoice_amount")
    @classmethod
    def validate_invoice_amount(cls, v: Decimal | None) -> Decimal | None:
        if v is not None and v < 0:
            raise ValueError("invoice_amount cannot be negative")
        return v


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
    bill_no: str | None = None # Invoice/Bill Number
    total_amount: Decimal
    invoice_amount: Decimal | None = None
    user_id: int
    status: int
    created_at: datetime
    updated_at: datetime
    created_by: int | None = None
    updated_by: int | None = None
    bills: list[PurchaseBillOut] = []

    model_config = ConfigDict(from_attributes=True)


class PurchaseEntryUpdate(BaseModel):
    vendor_id: int
    purchase_date: date
    bill_no: str | None = None # Invoice/Bill Number
    invoice_amount: Decimal | None = None
    items: list[PurchaseItemIn]

    @field_validator("invoice_amount")
    @classmethod
    def validate_invoice_amount(cls, v: Decimal | None) -> Decimal | None:
        if v is not None and v < 0:
            raise ValueError("invoice_amount cannot be negative")
        return v


class UserMinimal(BaseModel):
    id: int
    username: str
    full_name: str

    model_config = ConfigDict(from_attributes=True)


class PurchaseEntryFullOut(PurchaseEntryOut):
    items: list[PurchaseItemOut]
    user: UserMinimal | None = None

PurchaseEntryCreate.model_rebuild()
PurchaseItemOut.model_rebuild()
PurchaseEntryOut.model_rebuild()
PurchaseEntryUpdate.model_rebuild()
PurchaseEntryFullOut.model_rebuild()
