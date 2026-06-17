from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user, PermissionChecker
from app.db.models import User
from app.services import usage_check_service

router = APIRouter(prefix="/system", tags=["system"])

@router.get("/check_usage")
def check_usage(
    entity_type: str = Query(...), # vendor, item, category, etc
    entity_id: int = Query(...),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user)
):
    """
    Checks if an entity has usage in other tables before deletion.
    """
    return usage_check_service.check_entity_usage(entity_type, entity_id, db)
