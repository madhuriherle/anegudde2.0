from pydantic import BaseModel
from datetime import date, datetime
from typing import List, Optional

class UserMinimal(BaseModel):
    id: int
    full_name: str
    
    class Config:
        from_attributes = True

class TokenDetailCreate(BaseModel):
    token_count: int

class TokenDetailResponse(BaseModel):
    id: int
    generation_id: int
    receipt_number: int
    token_count: int
    created_at: datetime
    creator: Optional[UserMinimal] = None
    
    class Config:
        from_attributes = True

class TokenGenerationCreate(BaseModel):
    date: date
    total_tokens: int

class TokenGenerationResponse(BaseModel):
    id: int
    date: date
    total_tokens: int
    created_at: datetime
    details: Optional[List[TokenDetailResponse]] = []
    creator: Optional[UserMinimal] = None

    class Config:
        from_attributes = True

