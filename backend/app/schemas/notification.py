from datetime import datetime
from pydantic import BaseModel

class NotificationBase(BaseModel):
    title: str
    message: str
    notification_type: str = "info"
    link: str | None = None

class NotificationOut(NotificationBase):
    id: int
    is_read: int
    created_at: datetime

    class Config:
        from_attributes = True
