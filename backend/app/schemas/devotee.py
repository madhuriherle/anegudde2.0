from datetime import datetime
from pydantic import BaseModel, ConfigDict
from .donation import DonationEntryFullOut

class DevoteeBase(BaseModel):
    devotee_name: str
    phone_number: str
    email: str | None = None
    address: str | None = None
    city: str | None = None
    state: str | None = None
    pincode: str | None = None

class DevoteeCreate(DevoteeBase):
    pass

class DevoteeUpdate(DevoteeBase):
    devotee_name: str | None = None
    phone_number: str | None = None

class DevoteeOut(DevoteeBase):
    id: int
    status: int
    created_at: datetime
    updated_at: datetime
    created_by: int | None = None
    updated_by: int | None = None

    model_config = ConfigDict(from_attributes=True)


class DevoteeDetailOut(DevoteeOut):
    donations: list[DonationEntryFullOut] = []


DevoteeDetailOut.model_rebuild()
