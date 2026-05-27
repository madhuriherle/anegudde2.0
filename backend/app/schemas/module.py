from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel, ConfigDict

class ModuleBase(BaseModel):
    name: str
    icon: str | None = None
    parent_id: int | None = None
    route: str | None = None
    display_order: int = 0
    status: int = 1

    model_config = ConfigDict(from_attributes=True)

class ModuleCreate(ModuleBase):
    pass

class ModuleUpdate(BaseModel):
    name: str | None = None
    icon: str | None = None
    parent_id: int | None = None
    route: str | None = None
    display_order: int | None = None
    status: int | None = None

    model_config = ConfigDict(from_attributes=True)

class PrivilegeMinimal(BaseModel):
    id: int
    privilege_name: str
    description: str | None = None
    status: int

    model_config = ConfigDict(from_attributes=True)

class ModuleOut(ModuleBase):
    id: int
    created_at: datetime
    updated_at: datetime
    created_by: int | None = None
    updated_by: int | None = None
    submodules: list[ModuleOut] = []
    privileges: list[PrivilegeMinimal] = []

    model_config = ConfigDict(from_attributes=True)

ModuleOut.model_rebuild()
