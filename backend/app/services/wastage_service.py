from datetime import datetime, timezone
from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload
from app.db.models import MenuItem, User, WastageEntry, WastageItem, FinancialYear
from app.schemas.wastage import WastageEntryCreate, WastageEntryUpdate

def list_wastages(db: Session, financial_year: FinancialYear, page: int = 1, page_size: int = 20, q: str = None, status: int = None, search_field: str = None):
    query = db.query(WastageEntry).filter(WastageEntry.financial_year_id == financial_year.id).options(
        joinedload(WastageEntry.items).joinedload(WastageItem.menu_item), 
        joinedload(WastageEntry.user)
    )
    if status is not None: 
        query = query.filter(WastageEntry.status == status)
    
    # Optional search logic
    if q:
        from sqlalchemy import or_
        query = query.join(WastageEntry.items).join(WastageItem.menu_item).filter(
            or_(
                WastageEntry.reason.ilike(f"%{q}%"),
                MenuItem.dish_name.ilike(f"%{q}%")
            )
        ).distinct()

    return query.order_by(WastageEntry.id.desc()).offset((page - 1) * page_size).limit(page_size).all()

def create_wastage(payload: WastageEntryCreate, db: Session, current_user: User, financial_year: FinancialYear) -> WastageEntry:
    now = datetime.now(timezone.utc)
    fy_id = payload.financial_year_id or financial_year.id
    
    entry = WastageEntry(
        wastage_date=payload.wastage_date, 
        reason=payload.reason, 
        financial_year_id=fy_id,
        user_id=payload.user_id, 
        status=payload.status, 
        created_at=now, 
        updated_at=now, 
        created_by=current_user.id, 
        updated_by=current_user.id
    )
    db.add(entry); db.flush()
    
    for it in payload.items:
        db.add(WastageItem(
            wastage_entry_id=entry.id, 
            wastage_date=payload.wastage_date, 
            menu_item_id=it.menu_item_id, 
            quantity=it.quantity, 
            created_at=now, 
            updated_at=now, 
            created_by=current_user.id, 
            updated_by=current_user.id
        ))

    db.commit(); db.refresh(entry); return entry

def get_wastage(wastage_id: int, db: Session) -> WastageEntry:
    entry = db.query(WastageEntry).filter(WastageEntry.id == wastage_id).first()
    if not entry: raise HTTPException(status_code=404, detail="Not found")
    return entry

def get_wastage_full(wastage_id: int, db: Session) -> WastageEntry:
    entry = db.query(WastageEntry).options(
        joinedload(WastageEntry.user),
        joinedload(WastageEntry.items).joinedload(WastageItem.menu_item)
    ).filter(WastageEntry.id == wastage_id).first()
    if not entry: raise HTTPException(status_code=404, detail="Not found")
    return entry

def delete_wastage(wastage_id: int, db: Session, current_user: User) -> None:
    entry = get_wastage(wastage_id, db)
    db.query(WastageItem).filter(WastageItem.wastage_entry_id == wastage_id).delete()
    db.delete(entry); db.commit()

def update_wastage(wastage_id: int, payload: WastageEntryUpdate, db: Session, current_user: User, financial_year: FinancialYear) -> WastageEntry:
    delete_wastage(wastage_id, db, current_user)
    new_entry = create_wastage(payload, db, current_user, financial_year)
    return get_wastage_full(new_entry.id, db)
