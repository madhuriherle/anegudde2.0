from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, get_db
from app.db.models import Notification, User
router = APIRouter()
@router.post("/read-all", status_code=status.HTTP_204_NO_CONTENT)
def mark_all_as_read(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    db.query(Notification).filter(Notification.is_read == 0).update({"is_read": 1})
    db.commit()
    return None
