from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, field_validator
from .item import ItemOut


class DonationItemIn(BaseModel):
    item_id: int
    quantity: Decimal


class DonationEntryCreate(BaseModel):
    donation_type: int = 1
    donation_date: date
    devotee_id: int | None = None
    devotee_name: str
    phone_number: str
    email: str | None = None
    address: str | None = None
    city: str | None = None
    state: str | None = None
    pincode: str | None = None
    remarks: str | None = None
    user_id: int
    status: int = 1
    items: list[DonationItemIn]


class DonationItemOut(BaseModel):
    id: int
    donation_entry_id: int
    item_id: int
    quantity: Decimal
    created_at: datetime
    item: ItemOut | None = None

    model_config = ConfigDict(from_attributes=True)


class DonationEntryOut(BaseModel):
    id: int
    donation_type: int = 1
    financial_year_id: int | None = None
    receipt_prefix: str | None = None
    receipt_number: int | None = None
    receipt_display_number: str | None = None
    donation_date: date
    devotee_id: int | None = None
    devotee_name: str
    phone_number: str
    email: str | None = None
    address: str | None = None
    city: str | None = None
    state: str | None = None
    pincode: str | None = None
    remarks: str | None = None
    user_id: int
    status: int
    created_at: datetime
    updated_at: datetime
    created_by: int | None = None
    updated_by: int | None = None

    model_config = ConfigDict(from_attributes=True)


class UserMinimal(BaseModel):
    id: int
    username: str
    full_name: str

    model_config = ConfigDict(from_attributes=True)


class DonationEntryFullOut(DonationEntryOut):
    items: list[DonationItemOut]
    user: UserMinimal | None = None


DonationEntryCreate.model_rebuild()
DonationItemOut.model_rebuild()
DonationEntryOut.model_rebuild()
DonationEntryFullOut.model_rebuild()
