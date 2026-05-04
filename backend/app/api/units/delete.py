from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, get_db
from app.db.models import Unit, Item, User

router = APIRouter()

@router.delete("/{unit_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_unit(unit_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    row = db.query(Unit).filter(Unit.id == unit_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Unit not found")
    
    row.status = 0
    db.commit()
    return None
