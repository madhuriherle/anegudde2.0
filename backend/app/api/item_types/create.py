from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, PermissionChecker
from app.db.models import ItemType, User
from app.schemas.item_type import ItemTypeCreate, ItemTypeOut

router = APIRouter()


@router.post("/create_item_type", response_model=ItemTypeOut, status_code=status.HTTP_201_CREATED)
def create_item_type(
    request: Request,
    payload: ItemTypeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("item_types.write")),
):
    exists = db.query(ItemType).filter(ItemType.type_name == payload.type_name).first()
    if exists:
        raise HTTPException(status_code=400, detail="type_name already exists")

    data = payload.model_dump()

    now = datetime.now(timezone.utc)
    row = ItemType(
        **data,
        created_at=now,
        updated_at=now,
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    request.state.audit_meta = {
        "snapshot": {"id": row.id, "type_name": row.type_name}
    }
    return row
