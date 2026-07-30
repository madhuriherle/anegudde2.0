import logging
from datetime import datetime, timezone
from decimal import Decimal
import math
from fastapi import HTTPException
from sqlalchemy import String, or_, text, func
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import Session, joinedload
from app.db.models import ConsumptionEntry, ConsumptionItem, Item, StockLedger, User, WastageEntry, WastageItem
from app.schemas.consumption import ConsumptionEntryCreate, ConsumptionEntryUpdate
from app.services.item_service import get_item_last_price
from app.utils.stock_ledger_utils import compute_current_value

logger = logging.getLogger(__name__)

def list_consumptions(db: Session, page: int = 1, page_size: int = 20, q: str = None, status: int = None, search_field: str = None):
    import re
    query = db.query(ConsumptionEntry).filter(ConsumptionEntry.is_deleted == False).options(
        joinedload(ConsumptionEntry.items),
        joinedload(ConsumptionEntry.user),
        joinedload(ConsumptionEntry.wastages).joinedload(WastageEntry.items).joinedload(WastageItem.menu_item),
        joinedload(ConsumptionEntry.wastages).joinedload(WastageEntry.items).joinedload(WastageItem.item)
    )
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

from app.utils.date_utils import get_today_ist

def create_consumption(payload: ConsumptionEntryCreate, db: Session, current_user: User) -> ConsumptionEntry:
    now = datetime.now(timezone.utc)
    # --- SAFETY BLOCK: Prevent Future Dates ---
    if payload.usage_date > get_today_ist():
        raise HTTPException(status_code=400, detail="Usage date cannot be in the future.")

    # Restrict to one entry per day
    existing_entry = db.query(ConsumptionEntry).filter(
        ConsumptionEntry.usage_date == payload.usage_date,
        ConsumptionEntry.is_deleted == False
    ).first()
    if existing_entry:
        raise HTTPException(
            status_code=400,
            detail=f"A daily usage entry already exists for {payload.usage_date.strftime('%d-%m-%Y')}. Only one entry is allowed per day."
        )


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
    
    # Validate stock as-of usage date (not current live stock), so back-dated entries
    # cannot create negative historical closing stock.
    item_ids = [it.item_id for it in (payload.items or [])]
    opening_rows = db.query(Item.id, Item.opening_stock).filter(Item.id.in_(item_ids)).all()
    opening_map = {item_id: Decimal(str(opening_stock or 0)) for item_id, opening_stock in opening_rows}

    before_rows = (
        db.query(
            StockLedger.item_id,
            func.coalesce(func.sum(StockLedger.qty_in - StockLedger.qty_out), 0).label("net_before"),
        )
        .filter(
            StockLedger.item_id.in_(item_ids),
            StockLedger.status == 1,
            StockLedger.txn_date <= payload.usage_date,
            StockLedger.txn_type != 8,
        )
        .group_by(StockLedger.item_id)
        .all()
    )
    before_map = {r.item_id: Decimal(str(r.net_before or 0)) for r in before_rows}
    available_as_of = {
        item_id: opening_map.get(item_id, Decimal("0")) + before_map.get(item_id, Decimal("0"))
        for item_id in item_ids
    }

    entry = ConsumptionEntry(
        usage_date=payload.usage_date, 
        people_served=payload.people_served,
        remarks=payload.remarks,
        regular_cooking_persons=payload.regular_cooking_persons,
        additional_cooking_persons=payload.additional_cooking_persons,
        total_cooking_persons=(payload.regular_cooking_persons + payload.additional_cooking_persons),
        regular_cleaning_persons=payload.regular_cleaning_persons,
        additional_cleaning_persons=payload.additional_cleaning_persons,
        total_cleaning_persons=(payload.regular_cleaning_persons + payload.additional_cleaning_persons),
        regular_serving_persons=payload.regular_serving_persons,
        additional_serving_persons=payload.additional_serving_persons,
        total_serving_persons=(payload.regular_serving_persons + payload.additional_serving_persons),
        times_cooked=payload.times_cooked,
        user_id=payload.user_id, 
        status=payload.status, 
        created_at=now, 
        updated_at=now, 
        created_by=current_user.id, 
        updated_by=current_user.id
    )
    db.add(entry); db.flush()

    # Lock every involved item row up front, in a consistent (ascending id)
    # order - prevents lost updates from concurrent writes to the same
    # item's stock, and locking in a fixed order (rather than one at a
    # time as items come up in the loop) avoids two concurrent requests
    # deadlocking each other by locking the same items in reverse order.
    locked_items = {
        item.id: item
        for item in db.query(Item).filter(Item.id.in_(item_ids)).order_by(Item.id).with_for_update().all()
    } if item_ids else {}

    for it in payload.items:
        if it.quantity_used < 0 or it.qty_returned < 0:
            raise HTTPException(status_code=422, detail="quantity_used and qty_returned must be >= 0")
        if it.qty_returned > it.quantity_used:
            raise HTTPException(status_code=422, detail="qty_returned cannot be greater than quantity_used")

        item = locked_items.get(it.item_id)
        if item:
            unit_cost = it.unit_cost_at_time if it.unit_cost_at_time is not None else get_item_last_price(it.item_id, db)
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
            datewise_available = available_as_of.get(item.id, Decimal("0"))
            if datewise_available - Decimal(str(it.quantity_used)) < 0:
                raise HTTPException(
                    status_code=422,
                    detail=(
                        f"Insufficient stock for {item.item_name} on {payload.usage_date.strftime('%d-%m-%Y')}. "
                        f"Available: {datewise_available:.3f}, Requested: {Decimal(str(it.quantity_used)):.3f}"
                    ),
                )

            issue_balance = datewise_available - Decimal(str(it.quantity_used))
            return_balance = issue_balance + it.qty_returned
            available_as_of[item.id] = Decimal(str(return_balance))
            item.current_stock = return_balance

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
                current_value=compute_current_value(db, item.id, Decimal("0"), it.quantity_used * unit_cost),
                created_at=now, 
                updated_at=now, 
                created_by=current_user.id, 
                updated_by=current_user.id
            ))
            if it.qty_returned > 0:
                db.add(StockLedger(
                    item_id=item.id,
                    txn_date=payload.usage_date,
                    txn_type=6,
                    ref_table="consumption_entries:RAW_RETURN",
                    ref_id=entry.id,
                    qty_in=it.qty_returned,
                    qty_out=0,
                    unit_cost=unit_cost,
                    value_in=(it.qty_returned * unit_cost),
                    value_out=0,
                    balance=return_balance,
                    current_value=compute_current_value(db, item.id, it.qty_returned * unit_cost, it.quantity_used * unit_cost),
                    created_at=now,
                    updated_at=now,
                    created_by=current_user.id,
                    updated_by=current_user.id
                ))
    try:
        db.commit()
    except (IntegrityError, OperationalError) as e:
        db.rollback()
        logger.exception("DB error saving consumption entry")
        raise HTTPException(status_code=500, detail="Failed to save entry due to concurrent access. Please try again.")
    db.refresh(entry); return entry

def get_consumption(consumption_id: int, db: Session) -> ConsumptionEntry:
    entry = db.query(ConsumptionEntry).filter(ConsumptionEntry.id == consumption_id).first()
    if not entry: raise HTTPException(status_code=404, detail="Not found")
    return entry

def get_consumption_full(consumption_id: int, db: Session) -> ConsumptionEntry:
    entry = db.query(ConsumptionEntry).options(
        joinedload(ConsumptionEntry.user),
        joinedload(ConsumptionEntry.items),
        joinedload(ConsumptionEntry.wastages).joinedload(WastageEntry.items).joinedload(WastageItem.menu_item),
        joinedload(ConsumptionEntry.wastages).joinedload(WastageEntry.items).joinedload(WastageItem.item)
    ).filter(ConsumptionEntry.id == consumption_id).first()
    if not entry: raise HTTPException(status_code=404, detail="Not found")
    return entry

def delete_consumption(consumption_id: int, db: Session, current_user: User) -> None:
    entry = get_consumption(consumption_id, db)
    now = datetime.now(timezone.utc)

    wastages = db.query(WastageEntry).filter(WastageEntry.consumption_entry_id == consumption_id).all()
    wastage_items_by_entry = {
        w.id: db.query(WastageItem).filter(WastageItem.wastage_entry_id == w.id).all()
        for w in wastages
    }
    consumption_lines = db.query(ConsumptionItem).filter(ConsumptionItem.consumption_entry_id == consumption_id).all()

    # Lock every item touched by either restoration step up front, in a
    # consistent (ascending id) order - see create_consumption for why.
    all_item_ids = {
        wi.item_id for items in wastage_items_by_entry.values() for wi in items if wi.item_id
    } | {line.item_id for line in consumption_lines}
    locked_items = {
        item.id: item
        for item in db.query(Item).filter(Item.id.in_(all_item_ids)).order_by(Item.id).with_for_update().all()
    } if all_item_ids else {}

    # 1. Soft Delete linked wastage entries
    for w in wastages:
        # Restore stock for raw items in wastage
        for wi in wastage_items_by_entry[w.id]:
            if wi.item_id:
                item = locked_items.get(wi.item_id)
                if item:
                    item.current_stock = Decimal(item.current_stock or 0) + Decimal(str(wi.quantity))

        # Mark wastage and ledger entries as inactive
        w.status = 0
        w.updated_at = now
        w.updated_by = current_user.id
        db.execute(
            text("UPDATE stock_ledger SET status = 0 WHERE ref_table = 'wastage_items' AND ref_id = :rid"),
            {"rid": w.id}
        )

    # 2. Restore stock for consumption items
    for line in consumption_lines:
        item = locked_items.get(line.item_id)
        if item:
            item.current_stock = Decimal(item.current_stock or 0) + Decimal(line.net_quantity or 0)

    # 3. Soft delete the consumption record
    entry.status = 0
    entry.updated_at = now
    entry.updated_by = current_user.id
    entry.is_deleted = True
    entry.deleted_at = now
    entry.deleted_by_id = current_user.id

    # Mark associated ledger entries as inactive
    db.execute(
        text("UPDATE stock_ledger SET status = 0 WHERE ref_table LIKE 'consumption_entries%' AND ref_id = :rid"),
        {"rid": consumption_id}
    )
    
    try:
        db.commit()
    except (IntegrityError, OperationalError) as e:
        db.rollback()
        logger.exception("DB error deleting consumption entry %s", consumption_id)
        raise HTTPException(status_code=500, detail="Failed to delete entry. Please try again.")

def update_consumption(consumption_id: int, payload: ConsumptionEntryUpdate, db: Session, current_user: User) -> ConsumptionEntry:
    existing = get_consumption(consumption_id, db)
    now = datetime.now(timezone.utc)

    if payload.usage_date > get_today_ist():
        raise HTTPException(status_code=400, detail="Usage date cannot be in the future.")

    # Restrict to one entry per day
    existing_entry = db.query(ConsumptionEntry).filter(
        ConsumptionEntry.usage_date == payload.usage_date,
        ConsumptionEntry.is_deleted == False,
        ConsumptionEntry.id != consumption_id
    ).first()
    if existing_entry:
        raise HTTPException(
            status_code=400,
            detail=f"A daily usage entry already exists for {payload.usage_date.strftime('%d-%m-%Y')}. Only one entry is allowed per day."
        )

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

    # Reverse old consumption stock impact before applying new rows.
    old_lines = db.query(ConsumptionItem).filter(ConsumptionItem.consumption_entry_id == consumption_id).all()
    old_item_ids = [line.item_id for line in old_lines]
    # Lock in a consistent (ascending id) order - see create_consumption for why.
    locked_old_items = {
        item.id: item
        for item in db.query(Item).filter(Item.id.in_(old_item_ids)).order_by(Item.id).with_for_update().all()
    } if old_item_ids else {}
    for line in old_lines:
        item = locked_old_items.get(line.item_id)
        if item:
            item.current_stock = Decimal(item.current_stock or 0) + Decimal(line.net_quantity or 0)
            item.updated_at = now
            item.updated_by = current_user.id

    db.query(ConsumptionItem).filter(ConsumptionItem.consumption_entry_id == consumption_id).delete()
    db.execute(
        text("DELETE FROM stock_ledger WHERE ref_table LIKE 'consumption_entries%' AND ref_id = :rid"),
        {"rid": consumption_id}
    )

    existing.usage_date = payload.usage_date
    existing.people_served = payload.people_served
    existing.remarks = payload.remarks
    existing.regular_cooking_persons = payload.regular_cooking_persons
    existing.additional_cooking_persons = payload.additional_cooking_persons
    existing.total_cooking_persons = payload.regular_cooking_persons + payload.additional_cooking_persons
    existing.regular_cleaning_persons = payload.regular_cleaning_persons
    existing.additional_cleaning_persons = payload.additional_cleaning_persons
    existing.total_cleaning_persons = payload.regular_cleaning_persons + payload.additional_cleaning_persons
    existing.regular_serving_persons = payload.regular_serving_persons
    existing.additional_serving_persons = payload.additional_serving_persons
    existing.total_serving_persons = payload.regular_serving_persons + payload.additional_serving_persons
    existing.times_cooked = payload.times_cooked
    existing.updated_at = now
    existing.updated_by = current_user.id

    item_ids = [it.item_id for it in (payload.items or [])]
    opening_rows = db.query(Item.id, Item.opening_stock).filter(Item.id.in_(item_ids)).all()
    opening_map = {item_id: Decimal(str(opening_stock or 0)) for item_id, opening_stock in opening_rows}
    before_rows = (
        db.query(
            StockLedger.item_id,
            func.coalesce(func.sum(StockLedger.qty_in - StockLedger.qty_out), 0).label("net_before"),
        )
        .filter(
            StockLedger.item_id.in_(item_ids),
            StockLedger.status == 1,
            StockLedger.txn_date <= payload.usage_date,
            StockLedger.txn_type != 8,
        )
        .group_by(StockLedger.item_id)
        .all()
    )
    before_map = {r.item_id: Decimal(str(r.net_before or 0)) for r in before_rows}
    available_as_of = {
        item_id: opening_map.get(item_id, Decimal("0")) + before_map.get(item_id, Decimal("0"))
        for item_id in item_ids
    }

    # Items already locked above (locked_old_items) are re-locked here if they
    # overlap with the new item set - SQLAlchemy/Postgres just reuses the
    # existing lock held by this same transaction. Any new items in this
    # set not already locked get locked now, still in ascending id order.
    locked_new_items = {
        item.id: item
        for item in db.query(Item).filter(Item.id.in_(item_ids)).order_by(Item.id).with_for_update().all()
    } if item_ids else {}

    for it in payload.items:
        if it.quantity_used < 0 or it.qty_returned < 0:
            raise HTTPException(status_code=422, detail="quantity_used and qty_returned must be >= 0")
        if it.qty_returned > it.quantity_used:
            raise HTTPException(status_code=422, detail="qty_returned cannot be greater than quantity_used")

        item = locked_new_items.get(it.item_id)
        if item:
            unit_cost = it.unit_cost_at_time if it.unit_cost_at_time is not None else get_item_last_price(it.item_id, db)
            net_quantity = it.quantity_used - it.qty_returned
            line_total = net_quantity * unit_cost
            db.add(ConsumptionItem(
                consumption_entry_id=existing.id,
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
            datewise_available = available_as_of.get(item.id, Decimal("0"))
            if datewise_available - Decimal(str(it.quantity_used)) < 0:
                raise HTTPException(
                    status_code=422,
                    detail=(
                        f"Insufficient stock for {item.item_name} on {payload.usage_date.strftime('%d-%m-%Y')}. "
                        f"Available: {datewise_available:.3f}, Requested: {Decimal(str(it.quantity_used)):.3f}"
                    ),
                )

            issue_balance = datewise_available - Decimal(str(it.quantity_used))
            return_balance = issue_balance + it.qty_returned
            available_as_of[item.id] = Decimal(str(return_balance))
            item.current_stock = return_balance
            item.updated_at = now
            item.updated_by = current_user.id

            db.add(StockLedger(
                item_id=item.id,
                txn_date=payload.usage_date,
                txn_type=2,
                ref_table="consumption_entries:RAW_ISSUE",
                ref_id=existing.id,
                qty_in=0,
                qty_out=it.quantity_used,
                unit_cost=unit_cost,
                value_in=0,
                value_out=(it.quantity_used * unit_cost),
                balance=issue_balance,
                current_value=compute_current_value(db, item.id, Decimal("0"), it.quantity_used * unit_cost),
                created_at=now,
                updated_at=now,
                created_by=current_user.id,
                updated_by=current_user.id
            ))
            if it.qty_returned > 0:
                db.add(StockLedger(
                    item_id=item.id,
                    txn_date=payload.usage_date,
                    txn_type=6,
                    ref_table="consumption_entries:RAW_RETURN",
                    ref_id=existing.id,
                    qty_in=it.qty_returned,
                    qty_out=0,
                    unit_cost=unit_cost,
                    value_in=(it.qty_returned * unit_cost),
                    value_out=0,
                    balance=return_balance,
                    current_value=compute_current_value(db, item.id, it.qty_returned * unit_cost, it.quantity_used * unit_cost),
                    created_at=now,
                    updated_at=now,
                    created_by=current_user.id,
                    updated_by=current_user.id
                ))

    try:
        db.commit()
    except (IntegrityError, OperationalError) as e:
        db.rollback()
        logger.exception("DB error updating consumption entry %s", consumption_id)
        raise HTTPException(status_code=500, detail="Failed to update entry due to concurrent access. Please try again.")
    return get_consumption_full(existing.id, db)
