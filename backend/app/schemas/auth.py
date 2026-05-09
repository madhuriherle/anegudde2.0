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
    role_id: int
    email: str | None = None
    phone: str | None = None
    active_financial_year: FinancialYearOut | None = None

    model_config = ConfigDict(from_attributes=True)


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str
