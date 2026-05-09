from datetime import datetime, timezone
from decimal import Decimal
import math
from fastapi import HTTPException
from sqlalchemy import String, or_
from sqlalchemy.orm import Session, joinedload
from app.db.models import ConsumptionEntry, ConsumptionItem, Item, StockLedger, User
from app.schemas.consumption import ConsumptionEntryCreate, ConsumptionEntryUpdate
from app.services.item_service import get_item_last_price

def list_consumptions(db: Session, page: int = 1, page_size: int = 20, q: str = None, status: int = None, search_field: str = None):
    import re
    query = db.query(ConsumptionEntry).options(joinedload(ConsumptionEntry.items), joinedload(ConsumptionEntry.user))
    if status is not None: query = query.filter(ConsumptionEntry.status == status)
    
    # Smart Search: Extract dates from q if present
    from_date, to_date = None, None
    if q:
        date_patterns = re.findall(r"\d{4}-\d{2}-\d{2}", q)
        if len(date_patterns) >= 2:
            from_date, to_date = date_patterns[0], date_patterns[1]
            q = re.sub(r"\d{4}-\d{2}-\d{2}", "", q).strip()
        elif len(date_patterns) == 1:
            from_date = to_date = date_patterns[0]
            q = re.sub(r"\d{4}-\d{2}-\d{2}", "", q).strip()

    if from_date:
        query = query.filter(ConsumptionEntry.usage_date >= from_date)
    if to_date:
        query = query.filter(ConsumptionEntry.usage_date <= to_date)

    if q:
        like = f"%{q}%"
        if search_field == "id":
            query = query.filter(ConsumptionEntry.id.cast(String).ilike(like))
        elif search_field == "item":
            query = query.join(ConsumptionEntry.items).join(ConsumptionItem.item).filter(Item.item_name.ilike(like)).distinct()
        else:
            query = query.outerjoin(ConsumptionEntry.items).outerjoin(ConsumptionItem.item).filter(
                or_(
                    ConsumptionEntry.id.cast(String).ilike(like),
                    Item.item_name.ilike(like),
                    ConsumptionEntry.remarks.ilike(like),
                )
            ).distinct()
    
    total = query.count()
    offset = (page - 1) * page_size
    items = query.order_by(ConsumptionEntry.id.desc()).offset(offset).limit(page_size).all()
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": math.ceil(total / page_size) if total > 0 else 0
    }

def create_consumption(payload: ConsumptionEntryCreate, db: Session, current_user: User) -> ConsumptionEntry:
    now = datetime.now(timezone.utc)
    cooked_total = Decimal(payload.anna_remained) + Decimal(payload.saru_remained) + Decimal(payload.huli_remained) + Decimal(payload.payas_remained)
    if len(payload.items or []) == 0 and cooked_total <= 0:
        raise HTTPException(status_code=422, detail="At least one consumption row or cooked remained quantity is required")

    for manpower_value in [
        payload.regular_cooking_persons,
        payload.additional_cooking_persons,
        payload.regular_cleaning_persons,
        payload.additional_cleaning_persons,
        payload.regular_serving_persons,
        payload.additional_serving_persons,
        payload.times_cooked,
    ]:
        if manpower_value < 0:
            raise HTTPException(status_code=422, detail="Manpower fields must be >= 0")

    for cooked_value in [payload.anna_remained, payload.saru_remained, payload.huli_remained, payload.payas_remained]:
        if Decimal(cooked_value) < 0:
            raise HTTPException(status_code=422, detail="Cooked remained quantities must be >= 0")
    
    entry = ConsumptionEntry(
        usage_date=payload.usage_date, 
        people_served=payload.people_served,
        remarks=payload.remarks,
        regular_cooking_persons=payload.regular_cooking_persons,
        additional_cooking_persons=payload.additional_cooking_persons,
        regular_cleaning_persons=payload.regular_cleaning_persons,
        additional_cleaning_persons=payload.additional_cleaning_persons,
        regular_serving_persons=payload.regular_serving_persons,
        additional_serving_persons=payload.additional_serving_persons,
        times_cooked=payload.times_cooked,
        anna_remained=payload.anna_remained,
        saru_remained=payload.saru_remained,
        huli_remained=payload.huli_remained,
        payas_remained=payload.payas_remained,
        user_id=payload.user_id, 
        status=payload.status, 
        created_at=now, 
        updated_at=now, 
        created_by=current_user.id, 
        updated_by=current_user.id
    )
    db.add(entry); db.flush()
    for it in payload.items:
        if it.quantity_used < 0 or it.qty_returned < 0:
            raise HTTPException(status_code=422, detail="quantity_used and qty_returned must be >= 0")
        if it.qty_returned > it.quantity_used:
            raise HTTPException(status_code=422, detail="qty_returned cannot be greater than quantity_used")

        item = db.query(Item).filter(Item.id == it.item_id).first()
        if item:
            unit_cost = it.unit_cost_at_time or get_item_last_price(it.item_id, db)
            net_quantity = it.quantity_used - it.qty_returned
            line_total = net_quantity * unit_cost
            db.add(ConsumptionItem(
                consumption_entry_id=entry.id,
                usage_date=payload.usage_date,
                item_id=it.item_id,
                quantity_used=it.quantity_used,
                qty_returned=it.qty_returned,
                net_quantity=net_quantity,
                unit_cost_at_time=unit_cost,
                line_total=line_total,
                created_at=now,
                updated_at=now,
                created_by=current_user.id,
                updated_by=current_user.id
            ))
            current_stock = Decimal(item.current_stock or "0")
            if current_stock - net_quantity < 0:
                raise HTTPException(status_code=422, detail=f"Insufficient stock for item_id={item.id}")

            issue_balance = current_stock - it.quantity_used
            return_balance = issue_balance + it.qty_returned
            item.current_stock = str(return_balance)

            db.add(StockLedger(
                item_id=item.id,
                txn_date=payload.usage_date,
                txn_type=2,
                ref_table="consumption_entries:RAW_ISSUE",
                ref_id=entry.id,
                qty_in=0,
                qty_out=it.quantity_used,
                unit_cost=unit_cost,
                value_in=0,
                value_out=(it.quantity_used * unit_cost),
                balance=issue_balance,
                current_value=issue_balance * unit_cost,
                created_at=now, 
                updated_at=now, 
                created_by=current_user.id, 
                updated_by=current_user.id
            ))
            if it.qty_returned > 0:
                db.add(StockLedger(
                    item_id=item.id,
                    txn_date=payload.usage_date,
                    txn_type=2,
                    ref_table="consumption_entries:RAW_RETURN",
                    ref_id=entry.id,
                    qty_in=it.qty_returned,
                    qty_out=0,
                    unit_cost=unit_cost,
                    value_in=(it.qty_returned * unit_cost),
                    value_out=0,
                    balance=return_balance,
                    current_value=return_balance * unit_cost,
                    created_at=now,
                    updated_at=now,
                    created_by=current_user.id,
                    updated_by=current_user.id
                ))
    db.commit(); db.refresh(entry); return entry

def get_consumption(consumption_id: int, db: Session) -> ConsumptionEntry:
    entry = db.query(ConsumptionEntry).filter(ConsumptionEntry.id == consumption_id).first()
    if not entry: raise HTTPException(status_code=404, detail="Not found")
    return entry

def get_consumption_full(consumption_id: int, db: Session) -> ConsumptionEntry:
    entry = db.query(ConsumptionEntry).options(
        joinedload(ConsumptionEntry.user),
        joinedload(ConsumptionEntry.items)
    ).filter(ConsumptionEntry.id == consumption_id).first()
    if not entry: raise HTTPException(status_code=404, detail="Not found")
    return entry

def delete_consumption(consumption_id: int, db: Session, current_user: User) -> None:
    entry = get_consumption(consumption_id, db)
    # Restore stock before deleting lines.
    for line in db.query(ConsumptionItem).filter(ConsumptionItem.consumption_entry_id == consumption_id).all():
        item = db.query(Item).filter(Item.id == line.item_id).first()
        if item:
            item.current_stock = str(Decimal(item.current_stock or "0") + Decimal(line.net_quantity or 0))

    db.query(ConsumptionItem).filter(ConsumptionItem.consumption_entry_id == consumption_id).delete()
    db.query(StockLedger).filter(StockLedger.ref_table.like("consumption_entries%"), StockLedger.ref_id == consumption_id).delete()
    db.delete(entry); db.commit()

def update_consumption(consumption_id: int, payload: ConsumptionEntryUpdate, db: Session, current_user: User) -> ConsumptionEntry:
    existing = get_consumption(consumption_id, db)
    payload_create = ConsumptionEntryCreate(
        usage_date=payload.usage_date,
        people_served=payload.people_served,
        remarks=payload.remarks,
        regular_cooking_persons=payload.regular_cooking_persons,
        additional_cooking_persons=payload.additional_cooking_persons,
        regular_cleaning_persons=payload.regular_cleaning_persons,
        additional_cleaning_persons=payload.additional_cleaning_persons,
        regular_serving_persons=payload.regular_serving_persons,
        additional_serving_persons=payload.additional_serving_persons,
        times_cooked=payload.times_cooked,
        anna_remained=payload.anna_remained,
        saru_remained=payload.saru_remained,
        huli_remained=payload.huli_remained,
        payas_remained=payload.payas_remained,
        user_id=existing.user_id,
        status=existing.status,
        items=payload.items,
    )
    delete_consumption(consumption_id, db, current_user)
    new_entry = create_consumption(payload_create, db, current_user)
    return get_consumption_full(new_entry.id, db)
