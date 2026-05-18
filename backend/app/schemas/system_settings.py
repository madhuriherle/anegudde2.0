from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional

class SystemSettingsBase(BaseModel):
    temple_name: str
    temple_address: Optional[str] = None
    temple_contact: Optional[str] = None
    token_prefix: str
    purchase_prefix: str
    receipt_padding: int
    current_financial_year_id: Optional[int] = None

class SystemSettingsUpdate(SystemSettingsBase):
    pass

class SystemSettingsOut(SystemSettingsBase):
    id: int
    updated_at: datetime
    updated_by: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)
