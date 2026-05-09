from pydantic import BaseModel, ConfigDict
from datetime import date, datetime
from typing import Optional

class FinancialYearBase(BaseModel):
    name: str
    start_date: date
    end_date: date
    is_active: bool = False
    status: int = 1

class FinancialYearOut(FinancialYearBase):
    id: int
    created_at: datetime
    updated_at: datetime
    created_by: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)
