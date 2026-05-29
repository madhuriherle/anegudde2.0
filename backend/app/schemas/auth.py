from pydantic import BaseModel, ConfigDict
from .financial_year import FinancialYearOut


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
    role_rank_level: int | None = None
    is_all_access: bool = False
    privileges: list[str] = []
    email: str | None = None
    phone: str | None = None
    active_financial_year: FinancialYearOut | None = None

    model_config = ConfigDict(from_attributes=True)


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str


class ProfileUpdateRequest(BaseModel):
    username: str
    full_name: str
    email: str | None = None
    phone: str | None = None
    password: str | None = None
