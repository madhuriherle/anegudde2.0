from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, get_db, PermissionChecker
from app.db.models import Unit, Item, User

router = APIRouter()

@router.delete("/delete_unit/{unit_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_unit(
    unit_id: int, 
    request: Request,
    db: Session = Depends(get_db), 
    current_user: User = Depends(PermissionChecker("units.delete"))
):
    row = db.query(Unit).filter(Unit.id == unit_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Unit not found")
    
    request.state.audit_meta = {
        "unit_name": row.unit_name,
        "unit_code": row.unit_code,
        "snapshot": {"id": row.id, "unit_name": row.unit_name, "unit_code": row.unit_code}
    }
    
    from datetime import datetime, timezone
    row.is_deleted = True
    row.deleted_at = datetime.now(timezone.utc)
    row.deleted_by_id = current_user.id
    db.commit()
    return None
