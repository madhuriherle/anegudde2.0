from datetime import datetime

from pydantic import BaseModel, ConfigDict


class DonationTypeBase(BaseModel):
    type_name: str
    receipt_prefix: str | None = None
    status: int = 1

class DonationTypeCreate(DonationTypeBase):
    pass

class DonationTypeUpdate(BaseModel):
    type_name: str | None = None
    receipt_prefix: str | None = None
    status: int | None = None


class DonationTypeOut(DonationTypeBase):
    id: int
    created_at: datetime
    updated_at: datetime
    created_by: int | None = None
    updated_by: int | None = None

    model_config = ConfigDict(from_attributes=True)


DonationTypeCreate.model_rebuild()
DonationTypeUpdate.model_rebuild()
DonationTypeOut.model_rebuild()
