from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, get_db, PermissionChecker
from app.db.models import Unit, User
from app.schemas.unit import UnitOut, UnitUpdate
router = APIRouter()
@router.put("/update_unit/{unit_id}", response_model=UnitOut)
def update_unit(unit_id: int, payload: UnitUpdate, db: Session = Depends(get_db), current_user: User = Depends(PermissionChecker("units.write"))):
    row = db.query(Unit).filter(Unit.id == unit_id).first()
    if not row: raise HTTPException(status_code=404, detail="Unit not found")
    for k, v in payload.model_dump(exclude_unset=True).items(): setattr(row, k, v)
    row.updated_at = datetime.now(timezone.utc); row.updated_by = current_user.id
    db.commit(); db.refresh(row)
    return row
