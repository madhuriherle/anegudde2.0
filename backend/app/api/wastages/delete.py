from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user, PermissionChecker
from app.db.models import User
from app.services.wastage_service import delete_wastage

router = APIRouter()

@router.delete("/delete_wastage/{wastage_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_wastage(wastage_id: int, db: Session = Depends(get_db), current_user: User = Depends(PermissionChecker("wastages.delete"))):
    delete_wastage(wastage_id, db, current_user)
    return None
