from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel

class ActivityLogOut(BaseModel):
    id: int
    user_id: Optional[int]
    username: Optional[str]
    activity_at: datetime
    method: str
    endpoint: str
    action: str
    activity_status: str
    reason: Optional[str]
    http_status_code: Optional[int]
    ip_address: Optional[str]
    duration_ms: Optional[int]
    meta: dict[str, Any]

    class Config:
        from_attributes = True
