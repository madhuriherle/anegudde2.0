from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload
from app.api.deps import get_db, PermissionChecker
from app.db.models import ActivityLog, User
from app.schemas.audit import ActivityLogOut
from app.schemas.base import PaginatedResponse
import math

router = APIRouter()

@router.get("/list", response_model=PaginatedResponse[ActivityLogOut])
def list_activity_logs(
    db: Session = Depends(get_db),
    _: User = Depends(PermissionChecker("activity_logs.read")),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    username: str | None = Query(None),
    status: str | None = Query(None),
):
    query = db.query(ActivityLog).options(joinedload(ActivityLog.user))
    
    if username:
        query = query.join(ActivityLog.user).filter(User.username.ilike(f"%{username}%"))
    if status:
        query = query.filter(ActivityLog.activity_status == status)

    query = query.order_by(ActivityLog.activity_at.desc())
    
    total = query.count()
    offset = (page - 1) * page_size
    logs = query.offset(offset).limit(page_size).all()
    
    res_items = []
    for log in logs:
        # Create a dict from the log object to manually inject username
        log_dict = {
            "id": log.id,
            "user_id": log.user_id,
            "username": log.user.username if log.user else "System",
            "activity_at": log.activity_at,
            "method": log.method,
            "endpoint": log.endpoint,
            "action": log.action,
            "activity_status": log.activity_status,
            "reason": log.reason,
            "http_status_code": log.http_status_code,
            "ip_address": log.ip_address,
            "duration_ms": log.duration_ms,
            "meta": log.meta or {}
        }
        res_items.append(ActivityLogOut(**log_dict))

    return {
        "items": res_items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": math.ceil(total / page_size) if total > 0 else 0
    }
