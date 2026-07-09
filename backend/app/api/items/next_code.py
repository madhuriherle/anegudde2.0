from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.api.deps import get_db, get_current_user
from app.db.models import User, ItemSerialNumber
import re

router = APIRouter()

@router.get("/next-code")
def get_next_item_code(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Finds the highest numerical item code and increments it by 1.
    If it's zero-padded like 001, it will return 002.
    """
    serial_numbers = db.query(ItemSerialNumber.serial_number).filter(
        ItemSerialNumber.status == 1
    ).all()
    
    if not serial_numbers:
        return {"next_code": "001"}
        
    max_num = 0
    padding = 3
    
    for (serial,) in serial_numbers:
        if not serial: continue
        # Find numeric parts
        numbers = re.findall(r'\d+', serial)
        if numbers:
            last_num_str = numbers[-1]
            num = int(last_num_str)
            if num > max_num:
                max_num = num
                padding = len(last_num_str)
                
    next_num = max_num + 1
    return {"next_code": str(next_num).zfill(padding)}
