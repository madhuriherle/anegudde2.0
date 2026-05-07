from datetime import datetime
from pydantic import BaseModel, ConfigDict
from app.schemas.unit import UnitOut


class MenuItemBase(BaseModel):
    dish_name: str
    unit_id: int
    financial_year_id: int | None = None
    status: int = 1


class MenuItemCreate(MenuItemBase):
    pass


class MenuItemUpdate(BaseModel):
    dish_name: str | None = None
    unit_id: int | None = None
    financial_year_id: int | None = None
    status: int | None = None


class MenuItemOut(MenuItemBase):
    id: int
    created_at: datetime
    updated_at: datetime
    created_by: int | None = None
    updated_by: int | None = None
    unit: UnitOut | None = None

    model_config = ConfigDict(from_attributes=True)
