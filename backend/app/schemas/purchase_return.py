from datetime import datetime
from pydantic import BaseModel, ConfigDict
from decimal import Decimal
from .vendor import VendorOut
from .purchase import PurchaseEntryOut

class PurchaseReturnItemBase(BaseModel):
    item_id: int
    quantity: Decimal
    price: Decimal

class PurchaseReturnItemCreate(PurchaseReturnItemBase):
    pass

class PurchaseReturnItemOut(PurchaseReturnItemBase):
    id: int
    line_total: Decimal
    created_at: datetime
    item_name: str | None = None
    original_purchase_qty: Decimal | None = None
    original_purchase_price: Decimal | None = None
    
    model_config = ConfigDict(from_attributes=True)

class PurchaseReturnEntryBase(BaseModel):
    return_date: datetime | str
    vendor_id: int
    purchase_entry_id: int | None = None
    remarks: str | None = None
    status: int = 1

class PurchaseReturnEntryCreate(PurchaseReturnEntryBase):
    items: list[PurchaseReturnItemCreate]

class PurchaseReturnEntryOut(PurchaseReturnEntryBase):
    id: int
    total_return_amount: Decimal
    user_id: int
    created_at: datetime
    updated_at: datetime
    items: list[PurchaseReturnItemOut]
    vendor: VendorOut | None = None
    purchase_entry: PurchaseEntryOut | None = None
    model_config = ConfigDict(from_attributes=True)
