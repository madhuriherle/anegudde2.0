from datetime import datetime
from pydantic import BaseModel, ConfigDict


class ItemCategoryBase(BaseModel):
    type_id: int | None = None
    category_name: str
    status: int = 1


class ItemCategoryCreate(ItemCategoryBase):
    pass


class ItemCategoryUpdate(BaseModel):
    type_id: int | None = None
    category_name: str | None = None
    status: int | None = None


class ItemCategoryOut(ItemCategoryBase):
    id: int
    type_id: int
    created_at: datetime
    updated_at: datetime
    created_by: int | None = None
    updated_by: int | None = None

    model_config = ConfigDict(from_attributes=True)

ItemCategoryCreate.model_rebuild()
ItemCategoryUpdate.model_rebuild()
ItemCategoryOut.model_rebuild()
