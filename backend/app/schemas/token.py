from pydantic import BaseModel
from datetime import date as dt_date, datetime as dt_datetime
from typing import List, Optional

class UserMinimal(BaseModel):
    id: int
    full_name: str
    
    class Config:
        from_attributes = True

class TokenDetailCreate(BaseModel):
    token_count: int
    date: Optional[dt_date] = None

class TokenDetailResponse(BaseModel):
    id: int
    generation_id: int
    receipt_number: int
    token_count: int
    created_at: dt_datetime
    creator: Optional[UserMinimal] = None
    
    class Config:
        from_attributes = True

class TokenGenerationCreate(BaseModel):
    date: dt_date
    total_tokens: int

class TokenGenerationResponse(BaseModel):
    id: int
    date: dt_date
    total_tokens: int
    created_at: dt_datetime
    details: Optional[List[TokenDetailResponse]] = []
    creator: Optional[UserMinimal] = None

    class Config:
        from_attributes = True

class TokenDetailPaginatedResponse(BaseModel):
    items: List[TokenDetailResponse]
    total: int
    total_tokens: int
    page: int
    page_size: int
    total_pages: int

