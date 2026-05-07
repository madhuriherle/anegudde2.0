from datetime import datetime
from pydantic import BaseModel, ConfigDict

class RoleOut(BaseModel):
    id: int
    role_name: str

    model_config = ConfigDict(from_attributes=True)

class UserBase(BaseModel):
    username: str
    full_name: str
    role_id: int
    email: str | None = None
    phone: str | None = None

    model_config = ConfigDict(from_attributes=True)

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    username: str | None = None
    full_name: str | None = None
    role_id: int | None = None
    email: str | None = None
    phone: str | None = None
    password: str | None = None
    status: int | None = None

    model_config = ConfigDict(from_attributes=True)

class UserOut(UserBase):
    id: int
    status: int
    created_at: datetime
    updated_at: datetime
    created_by: int | None = None
    updated_by: int | None = None

    model_config = ConfigDict(from_attributes=True)
