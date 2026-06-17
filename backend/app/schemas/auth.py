from datetime import datetime
from pydantic import BaseModel, ConfigDict, field_validator
from .financial_year import FinancialYearOut
from .password import validate_password_complexity


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    username: str
    password: str


class AuthUserOut(BaseModel):
    id: int
    username: str
    full_name: str
    user_code: str | None = None
    role_id: int
    role_name: str | None = None
    role_rank_level: int | None = None
    is_all_access: bool = False
    privileges: list[str] = []
    email: str | None = None
    phone: str | None = None
    created_at: datetime | None = None
    active_financial_year: FinancialYearOut | None = None

    model_config = ConfigDict(from_attributes=True)


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, value: str) -> str:
        return validate_password_complexity(value)


class ProfileUpdateRequest(BaseModel):
    username: str
    full_name: str
    email: str | None = None
    phone: str | None = None
