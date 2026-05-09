from datetime import datetime
from pydantic import BaseModel, ConfigDict


class VendorBase(BaseModel):
    vendor_code: str
    vendor_name: str
    contact_person: str | None = None
    contact_number: str
    address_line1: str
    city: str | None = None
    state: str | None = None
    postal_code: str | None = None
    opening_balance: str = "0"
    status: int = 1


class VendorCreate(VendorBase):
    vendor_code: str | None = None


class VendorUpdate(BaseModel):
    vendor_code: str | None = None
    vendor_name: str | None = None
    contact_person: str | None = None
    contact_number: str | None = None
    address_line1: str | None = None
    city: str | None = None
    state: str | None = None
    postal_code: str | None = None
    opening_balance: str | None = None
    status: int | None = None


class VendorOut(VendorBase):
    id: int
    created_at: datetime
    updated_at: datetime
    created_by: int | None = None
    updated_by: int | None = None

    model_config = ConfigDict(from_attributes=True)

VendorCreate.model_rebuild()
VendorUpdate.model_rebuild()
VendorOut.model_rebuild()
