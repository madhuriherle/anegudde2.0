from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.api.deps import get_db, PermissionChecker
from app.db.models import ItemCategory, User

router = APIRouter()

@router.delete("/delete_category/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(
    category_id: int,
    request: Request,
    db: Session = Depends(get_db),
    _: User = Depends(PermissionChecker("item_categories.delete"))
):
    row = db.query(ItemCategory).filter(ItemCategory.id == category_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Category not found")
    
    request.state.audit_meta = {"category_name": row.category_name}

    row.status = 0
    db.commit()
    return None
