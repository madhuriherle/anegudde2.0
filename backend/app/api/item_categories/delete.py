from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, get_db
from app.db.models import ItemCategory, Item, User

router = APIRouter()

@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(category_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    row = db.query(ItemCategory).filter(ItemCategory.id == category_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Category not found")
    
    row.status = 0
    db.commit()
    return None
