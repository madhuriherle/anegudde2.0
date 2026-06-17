from datetime import datetime, timezone
from typing import Generic, TypeVar
from pydantic import BaseModel, ConfigDict, field_validator

T = TypeVar("T")

class UTCBaseModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    @field_validator("*", mode="after")
    @classmethod
    def ensure_utc_all_datetimes(cls, v: any) -> any:
        if isinstance(v, datetime):
            if v.tzinfo is None:
                return v.replace(tzinfo=timezone.utc)
        return v

class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
    total_pages: int
