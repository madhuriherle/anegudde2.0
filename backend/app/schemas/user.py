from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel, ConfigDict, field_validator
from .password import validate_password_complexity

class RoleOut(BaseModel):
    id: int
    role_name: str
    rank_level: int
    is_all_access: bool
    module_id: int | None = None
    status: int

    model_config = ConfigDict(from_attributes=True)

class RoleCreate(BaseModel):
    role_name: str
    rank_level: int
    is_all_access: bool = False
    module_id: int | None = None

    @field_validator("module_id", mode="before")
    @classmethod
    def coerce_zero_module(cls, v):
        if v == 0 or v == "0":
            return None
        return v

class RoleUpdate(BaseModel):
    role_name: str | None = None
    rank_level: int | None = None
    is_all_access: bool | None = None
    module_id: int | None = None
    status: int | None = None

    @field_validator("module_id", mode="before")
    @classmethod
    def coerce_zero_module(cls, v):
        if v == 0 or v == "0":
            return None
        return v

class PrivilegeOut(BaseModel):
    id: int
    privilege_name: str
    description: str | None = None

    model_config = ConfigDict(from_attributes=True)

class RolePrivilegeUpdate(BaseModel):
    privilege_ids: list[int]

class UserBase(BaseModel):
    username: str
    full_name: str
    role_id: int
    user_code: str | None = None
    email: str | None = None
    phone: str | None = None

    model_config = ConfigDict(from_attributes=True)

class UserCreate(UserBase):
    password: str

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return validate_password_complexity(value)

class UserUpdate(BaseModel):
    username: str | None = None
    full_name: str | None = None
    role_id: int | None = None
    user_code: str | None = None
    email: str | None = None
    phone: str | None = None
    password: str | None = None
    status: int | None = None

    model_config = ConfigDict(from_attributes=True)

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str | None) -> str | None:
        if value is None or value == "":
            return value
        return validate_password_complexity(value)

class UserOut(UserBase):
    id: int
    status: int
    created_at: datetime
    updated_at: datetime
    created_by: int | None = None
    updated_by: int | None = None
    role: RoleOut | None = None

    model_config = ConfigDict(from_attributes=True)

UserCreate.model_rebuild()
UserUpdate.model_rebuild()
UserOut.model_rebuild()
