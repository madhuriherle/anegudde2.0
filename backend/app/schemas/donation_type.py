from datetime import datetime
from pydantic import BaseModel, ConfigDict
from .module import ModuleOut

class DonationTypeBase(BaseModel):
    type_name: str
    receipt_prefix: str | None = None
    is_item_donation: bool = False
    status: int = 1

class DonationTypeCreate(DonationTypeBase):
    module_ids: list[int] = []

class DonationTypeUpdate(BaseModel):
    type_name: str | None = None
    receipt_prefix: str | None = None
    is_item_donation: bool | None = None
    status: int | None = None
    module_ids: list[int] | None = None


class DonationTypeOut(DonationTypeBase):
    id: int
    created_at: datetime
    updated_at: datetime
    created_by: int | None = None
    updated_by: int | None = None
    modules: list[ModuleOut] = []

    model_config = ConfigDict(from_attributes=True)
