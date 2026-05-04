from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict


class VendorBase(BaseModel):
    vendor_code: str
    vendor_name: str
    contact_number: str
    alternate_contact_number: str | None = None
    email: str | None = None
    address_line1: str
    address_line2: str | None = None
    city: str | None = None
    state: str | None = None
    postal_code: str | None = None
    gst_number: str | None = None
    pan_number: str | None = None
    opening_balance: Decimal = Decimal("0")
    current_balance: Decimal = Decimal("0")
    credit_limit: Decimal | None = None
    notes: str | None = None
    status: int = 1


class VendorCreate(VendorBase):
    vendor_code: str | None = None


class VendorUpdate(BaseModel):
    vendor_code: str | None = None
    vendor_name: str | None = None
    contact_number: str | None = None
    alternate_contact_number: str | None = None
    email: str | None = None
    address_line1: str | None = None
    address_line2: str | None = None
    city: str | None = None
    state: str | None = None
    postal_code: str | None = None
    gst_number: str | None = None
    pan_number: str | None = None
    opening_balance: Decimal | None = None
    current_balance: Decimal | None = None
    credit_limit: Decimal | None = None
    notes: str | None = None
    status: int | None = None


class VendorOut(VendorBase):
    id: int
    created_at: datetime
    updated_at: datetime
    created_by: int | None = None
    updated_by: int | None = None

    model_config = ConfigDict(from_attributes=True)
