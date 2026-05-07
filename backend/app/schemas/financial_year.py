from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional

class FinancialYearBase(BaseModel):
    name: str
    start_date: date
    end_date: date
    is_active: bool = False
    status: int = 1

class FinancialYearCreate(FinancialYearBase):
    pass

class FinancialYearUpdate(BaseModel):
    name: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_active: Optional[bool] = None
    status: Optional[int] = None

class FinancialYear(FinancialYearBase):
    id: int
    created_at: datetime
    updated_at: datetime
    created_by: Optional[int] = None

    class Config:
        from_attributes = True
