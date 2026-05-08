from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app.db.models import ItemSerialNumber, Item
from app.schemas.item import ItemOut

router = APIRouter()

@router.get("/by_serial/{serial_no}", response_model=ItemOut)
async def get_item_by_serial(serial_no: str, db: Session = Depends(get_db)):
    serial = db.query(ItemSerialNumber).filter(
        ItemSerialNumber.serial_number == serial_no,
        ItemSerialNumber.status == 1
    ).first()
    
    if not serial:
        raise HTTPException(status_code=404, detail="Item not found with this serial number")
        
    item = db.query(Item).filter(Item.id == serial.item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
        
    return item
