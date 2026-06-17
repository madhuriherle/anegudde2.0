from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from .item import ItemOut
from .base import UTCBaseModel


class DonationItemIn(BaseModel):
    item_id: int
    quantity: Decimal


class DonationEntryCreate(BaseModel):
    donation_type: int = 1
    donation_mode: int = 0  # 0: ITEM, 1: AMOUNT
    total_gross_amount: Decimal | None = None
    amount_donation_type: str | None = None
    donation_amount_master_id: int | None = None
    amount_note: str | None = None
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
    items: list[DonationItemIn] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_donation_mode(self):
        if self.donation_mode not in {0, 1}:
            raise ValueError("Donation mode must be 0 (ITEM) or 1 (AMOUNT)")
        if self.donation_mode == 0 and not self.items:
            raise ValueError("At least one item is required")
        if self.donation_mode == 1:
            self.amount_donation_type = (self.amount_donation_type or "CUSTOM").upper()
            if self.amount_donation_type not in {"CUSTOM", "SPECIFIC"}:
                raise ValueError("Amount donation type must be CUSTOM or SPECIFIC")
            if self.total_gross_amount is None or self.total_gross_amount <= 0:
                raise ValueError("Amount is required")
            if self.amount_donation_type == "SPECIFIC" and not self.donation_amount_master_id:
                raise ValueError("Specific amount selection is required")
        return self


class DonationItemOut(UTCBaseModel):
    id: int
    donation_entry_id: int
    item_id: int
    quantity: Decimal
    created_at: datetime
    item: ItemOut | None = None


class DonationEntryOut(UTCBaseModel):
    id: int
    donation_type: int = 1
    financial_year_id: int | None = None
    receipt_prefix: str | None = None
    receipt_number: int | None = None
    receipt_display_number: str | None = None
    donation_mode: int = 0  # 0: ITEM, 1: AMOUNT
    total_gross_amount: Decimal | None = None
    amount_donation_type: str | None = None
    donation_amount_master_id: int | None = None
    amount_note: str | None = None
    user_code: str | None = None
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
    receipt_pdf_url: str | None = None
    user_id: int
    status: int
    created_at: datetime
    updated_at: datetime
    created_by: int | None = None
    updated_by: int | None = None


class UserMinimal(UTCBaseModel):
    id: int
    username: str
    full_name: str
    user_code: str | None = None


class DonationAmountMasterBase(BaseModel):
    title: str
    amount: Decimal
    description: str | None = None
    status: int = 1


class DonationAmountMasterCreate(DonationAmountMasterBase):
    pass


class DonationAmountMasterUpdate(BaseModel):
    title: str | None = None
    amount: Decimal | None = None
    description: str | None = None
    status: int | None = None


class DonationAmountMasterOut(DonationAmountMasterBase, UTCBaseModel):
    id: int
    created_at: datetime
    updated_at: datetime
    created_by: int | None = None
    updated_by: int | None = None


class DonationTypeOut(UTCBaseModel):
    id: int
    type_name: str
    receipt_prefix: str | None = None
    is_item_donation: bool = False
    status: int = 1


class DonationEntryFullOut(DonationEntryOut):
    items: list[DonationItemOut]
    user: UserMinimal | None = None
    donation_type_master: DonationTypeOut | None = None
    donation_amount_master: DonationAmountMasterOut | None = None


DonationEntryCreate.model_rebuild()
DonationItemOut.model_rebuild()
DonationEntryOut.model_rebuild()
DonationEntryFullOut.model_rebuild()
DonationAmountMasterOut.model_rebuild()
