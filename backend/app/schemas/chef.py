from datetime import datetime
from pydantic import BaseModel, ConfigDict


class ChefBase(BaseModel):
    chef_name: str
    phone: str | None = None
    status: int = 1


class ChefCreate(ChefBase):
    user_id: int


class ChefOut(ChefBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    created_by: int | None = None
    updated_by: int | None = None

    model_config = ConfigDict(from_attributes=True)
