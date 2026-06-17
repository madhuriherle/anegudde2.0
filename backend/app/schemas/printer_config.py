from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional

class PrinterConfigCreate(BaseModel):
    machine_id: Optional[str] = None
    context: str
    printer_name: str
    is_default: bool = False

class PrinterConfigUpdate(BaseModel):
    printer_name: Optional[str] = None
    is_default: Optional[bool] = None

class PrinterConfigOut(BaseModel):
    id: int
    machine_id: Optional[str] = None
    context: str
    printer_name: str
    is_default: bool = False
    created_at: datetime
    updated_at: datetime
    created_by: Optional[int] = None
    updated_by: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)

class PrinterConfigListOut(BaseModel):
    items: list[PrinterConfigOut]
    total: int
