from datetime import datetime
from pydantic import BaseModel, ConfigDict


class UnitBase(BaseModel):
    unit_name: str
    unit_code: str
    status: int = 1


class UnitCreate(UnitBase):
    pass


class UnitUpdate(BaseModel):
    unit_name: str | None = None
    unit_code: str | None = None
    status: int | None = None


class UnitOut(UnitBase):
    id: int
    created_at: datetime
    updated_at: datetime
    created_by: int | None = None
    updated_by: int | None = None

    model_config = ConfigDict(from_attributes=True)
