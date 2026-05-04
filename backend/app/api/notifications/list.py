from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, get_db
from app.db.models import Notification, User
from app.schemas.notification import NotificationOut
router = APIRouter()
@router.get("/", response_model=list[NotificationOut])
def list_notifications(db: Session = Depends(get_db), _: User = Depends(get_current_user), unread_only: bool = False):
    query = db.query(Notification)
    if unread_only: query = query.filter(Notification.is_read == 0)
    return query.order_by(Notification.created_at.desc()).limit(50).all()

