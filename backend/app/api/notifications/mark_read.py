from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, get_db
from app.db.models import Notification, User
router = APIRouter()
@router.post("/mark_read/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
def mark_as_read(notification_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    notif = db.query(Notification).filter(Notification.id == notification_id).first()
    if notif:
        notif.is_read = 1
        db.commit()
    return None
