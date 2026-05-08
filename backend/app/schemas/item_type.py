from datetime import datetime
from pydantic import BaseModel, ConfigDict


class ItemTypeBase(BaseModel):
    type_name: str
    financial_year_id: int | None = None
    status: int = 1


class ItemTypeCreate(ItemTypeBase):
    pass


class ItemTypeOut(ItemTypeBase):
    id: int
    created_at: datetime
    updated_at: datetime
    created_by: int | None = None
    updated_by: int | None = None

    model_config = ConfigDict(from_attributes=True)

ItemTypeCreate.model_rebuild()
ItemTypeOut.model_rebuild()
