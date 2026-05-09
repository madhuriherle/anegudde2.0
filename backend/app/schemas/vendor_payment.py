from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict


class VendorPaymentCreate(BaseModel):
    vendor_id: int
    payment_date: date
    amount: Decimal
    payment_mode: str
    reference_no: str | None = None
    remarks: str | None = None
    user_id: int | None = None
    status: int = 1


class VendorPaymentOut(VendorPaymentCreate):
    id: int
    created_at: datetime
    updated_at: datetime
    created_by: int | None = None
    updated_by: int | None = None

    model_config = ConfigDict(from_attributes=True)
