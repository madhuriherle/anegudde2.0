from datetime import datetime, timezone
from decimal import Decimal
import math
from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload
from app.db.models import DonationAmountMaster, DonationEntry, DonationItem, Item, StockLedger, User, Devotee, DonationType
from app.schemas.donation import DonationAmountMasterCreate, DonationAmountMasterUpdate, DonationEntryCreate
from app.utils.stock_ledger_utils import compute_current_value
from app.services import devotee_service
from app.schemas.devotee import DevoteeCreate
from app.services.receipt_sequence_service import next_donation_receipt
from app.utils.donation_receipt import generate_and_save_donation_receipt

def _validate_donation_type(payload: DonationEntryCreate, db: Session) -> int:
    donation_type_id = payload.donation_type or 1
    donation_type = (
        db.query(DonationType)
        .filter(DonationType.id == donation_type_id, DonationType.status == 1)
        .first()
    )
    if not donation_type:
        raise HTTPException(status_code=400, detail="Invalid donation type")
    return donation_type_id

def list_donations(db: Session, page: int = 1, page_size: int = 20, q: str = None, donation_type_id: int | None = None):
    # ... (existing smart search logic remains same)
    import re
    from_date, to_date = None, None
    
    if q:
        date_patterns = re.findall(r"\d{4}-\d{2}-\d{2}", q)
        if len(date_patterns) >= 2:
            from_date, to_date = date_patterns[0], date_patterns[1]
            q = re.sub(r"\d{4}-\d{2}-\d{2}", "", q).strip()
        elif len(date_patterns) == 1:
            from_date = to_date = date_patterns[0]
            q = re.sub(r"\d{4}-\d{2}-\d{2}", "", q).strip()

    query = db.query(DonationEntry).options(
        joinedload(DonationEntry.items).joinedload(DonationItem.item),
        joinedload(DonationEntry.user),
        joinedload(DonationEntry.donation_amount_master),
        joinedload(DonationEntry.devotee)
    ).filter(DonationEntry.is_deleted == False, DonationEntry.status == 1)

    if donation_type_id:
        query = query.filter(DonationEntry.donation_type == donation_type_id)

    if from_date:
        query = query.filter(DonationEntry.donation_date >= from_date)
    if to_date:
        query = query.filter(DonationEntry.donation_date <= to_date)

    if q:
        like = f"%{q}%"
        query = query.filter(
            (DonationEntry.devotee_name.ilike(like)) |
            (DonationEntry.phone_number.ilike(like)) |
            (DonationEntry.address.ilike(like)) |
            (DonationEntry.city.ilike(like)) |
            (DonationEntry.state.ilike(like)) |
            (DonationEntry.pincode.ilike(like)) |
            (DonationEntry.remarks.ilike(like))
        )

    total = query.count()
    offset = (page - 1) * page_size
    items = query.order_by(DonationEntry.id.desc()).offset(offset).limit(page_size).all()

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": math.ceil(total / page_size) if total > 0 else 0
    }

from app.utils.date_utils import get_today_ist

def list_amount_masters(db: Session, active_only: bool = False):
    query = db.query(DonationAmountMaster).filter(DonationAmountMaster.is_deleted == False)
    if active_only:
        query = query.filter(DonationAmountMaster.status == 1)
    return query.order_by(DonationAmountMaster.id.desc()).all()

def create_amount_master(payload: DonationAmountMasterCreate, db: Session, current_user: User) -> DonationAmountMaster:
    now = datetime.now(timezone.utc)
    title = payload.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Title is required")
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than zero")
    row = DonationAmountMaster(
        title=title,
        amount=payload.amount,
        description=payload.description,
        status=payload.status,
        created_at=now,
        updated_at=now,
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row

def update_amount_master(amount_id: int, payload: DonationAmountMasterUpdate, db: Session, current_user: User) -> DonationAmountMaster:
    row = db.query(DonationAmountMaster).filter(DonationAmountMaster.id == amount_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Amount option not found")
    if payload.title is not None:
        title = payload.title.strip()
        if not title:
            raise HTTPException(status_code=400, detail="Title is required")
        row.title = title
    if payload.amount is not None:
        if payload.amount <= 0:
            raise HTTPException(status_code=400, detail="Amount must be greater than zero")
        row.amount = payload.amount
    if payload.description is not None:
        row.description = payload.description
    if payload.status is not None:
        row.status = payload.status
    row.updated_at = datetime.now(timezone.utc)
    row.updated_by = current_user.id
    db.commit()
    db.refresh(row)
    return row

def delete_amount_master(amount_id: int, db: Session, current_user: User) -> None:
    row = db.query(DonationAmountMaster).filter(DonationAmountMaster.id == amount_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Amount option not found")
    row.is_deleted = True
    row.deleted_at = datetime.now(timezone.utc)
    row.deleted_by_id = current_user.id
    db.commit()

def _validate_amount_selection(payload: DonationEntryCreate, db: Session) -> None:
    if payload.donation_mode != 1:  # 1: AMOUNT
        return
    if payload.amount_donation_type == "SPECIFIC":
        option = db.query(DonationAmountMaster).filter(
            DonationAmountMaster.id == payload.donation_amount_master_id,
            DonationAmountMaster.status == 1,
        ).first()
        if not option:
            raise HTTPException(status_code=400, detail="Invalid specific amount selection")
        payload.total_gross_amount = option.amount

def create_donation(payload: DonationEntryCreate, db: Session, current_user: User) -> DonationEntry:
    now = datetime.now(timezone.utc)
    today = get_today_ist()
    
    _validate_amount_selection(payload, db)

    # CRM Logic: Link/Create Devotee
    devotee = devotee_service.create_or_update_devotee(
        DevoteeCreate(
            devotee_name=payload.devotee_name,
            phone_number=payload.phone_number,
            email=payload.email,
            address=payload.address,
            city=payload.city,
            state=payload.state,
            pincode=payload.pincode
        ),
        db,
        current_user
    )

    donation_type_id = _validate_donation_type(payload, db)
    financial_year_id, receipt_prefix, receipt_number, receipt_display_number = next_donation_receipt(
        db,
        payload.donation_date,
        donation_type_id,
    )

    entry = DonationEntry(
        donation_type=donation_type_id,
        financial_year_id=financial_year_id,
        receipt_prefix=receipt_prefix,
        receipt_number=receipt_number,
        receipt_display_number=receipt_display_number,
        donation_mode=payload.donation_mode,
        total_gross_amount=payload.total_gross_amount,
        amount_donation_type=payload.amount_donation_type if payload.donation_mode == 1 else None,
        donation_amount_master_id=payload.donation_amount_master_id if payload.donation_mode == 1 and payload.amount_donation_type == "SPECIFIC" else None,
        amount_note=payload.amount_note if payload.donation_mode == 1 else None,
        user_code=current_user.user_code,
        donation_date=payload.donation_date,
        devotee_id=devotee.id,
        devotee_name=payload.devotee_name, # Also keep snapshot in donation table
        phone_number=payload.phone_number,
        email=payload.email,
        address=payload.address,
        city=payload.city,
        state=payload.state,
        pincode=payload.pincode,
        remarks=payload.remarks,
        user_id=payload.user_id,
        status=1,
        created_at=now,
        updated_at=now,
        created_by=current_user.id,
        updated_by=current_user.id
    )
    db.add(entry)
    db.flush()
    
    item_ids = [it.item_id for it in (payload.items if payload.donation_mode == 0 else [])]
    locked_items = {
        item.id: item
        for item in db.query(Item).filter(Item.id.in_(item_ids)).order_by(Item.id).with_for_update().all()
    } if item_ids else {}
    
    for it in (payload.items if payload.donation_mode == 0 else []):
        # ... (rest of stock update logic)
        item = locked_items.get(it.item_id)
        if not item:
            raise HTTPException(status_code=400, detail=f"Invalid item_id: {it.item_id}")

        donation_item = DonationItem(
            donation_entry_id=entry.id,
            item_id=it.item_id,
            quantity=it.quantity,
            created_at=now
        )
        db.add(donation_item)
        
        item.current_stock = Decimal(item.current_stock or 0) + it.quantity
        item.updated_at = now
        item.updated_by = current_user.id

        db.add(StockLedger(
            item_id=item.id,
            txn_date=payload.donation_date,
            txn_type=7,
            ref_table="donation_entries",
            ref_id=entry.id,
            qty_in=it.quantity,
            qty_out=0,
            unit_cost=0,
            value_in=0,
            value_out=0,
            balance=item.current_stock,
            current_value=compute_current_value(db, item.id, Decimal("0"), Decimal("0")),
            created_at=now,
            updated_at=now,
            created_by=current_user.id,
            updated_by=current_user.id
        ))

    db.commit()
    db.refresh(entry)

    # Generate and save receipt PDF automatically
    try:
        pdf_url = generate_and_save_donation_receipt(entry.id, db)
        if pdf_url:
            entry.receipt_pdf_url = pdf_url
            db.commit()
            db.refresh(entry)
    except Exception as e:
        import logging
        logger = logging.getLogger("uvicorn.error")
        logger.error(f"Failed to generate receipt on save: {str(e)}")

    return entry

def get_donation(donation_id: int, db: Session) -> DonationEntry:
    entry = (
        db.query(DonationEntry)
        .options(
            joinedload(DonationEntry.items).joinedload(DonationItem.item).joinedload(Item.unit),
            joinedload(DonationEntry.user),
            joinedload(DonationEntry.donation_type_master),
            joinedload(DonationEntry.donation_amount_master),
            joinedload(DonationEntry.devotee),
        )
        .filter(DonationEntry.id == donation_id, DonationEntry.status == 1)
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Donation not found")
    return entry

def update_donation(donation_id: int, payload: DonationEntryCreate, db: Session, current_user: User) -> DonationEntry:
    now = datetime.now(timezone.utc)
    today = get_today_ist()
    
    _validate_amount_selection(payload, db)

    entry = db.query(DonationEntry).filter(DonationEntry.id == donation_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Donation not found")
    
    # 1. Reverse Previous Stock Changes
    old_item_ids = [d_item.item_id for d_item in entry.items]
    new_item_ids = [it.item_id for it in (payload.items if payload.donation_mode == 0 else [])]
    all_item_ids = list(set(old_item_ids + new_item_ids))
    locked_items = {
        item.id: item
        for item in db.query(Item).filter(Item.id.in_(all_item_ids)).order_by(Item.id).with_for_update().all()
    } if all_item_ids else {}

    for d_item in entry.items:
        item = locked_items.get(d_item.item_id)
        if item:
            item.current_stock = Decimal(item.current_stock or 0) - d_item.quantity
    
    db.query(DonationItem).filter(DonationItem.donation_entry_id == donation_id).delete()
    db.query(StockLedger).filter(
        StockLedger.ref_table == "donation_entries",
        StockLedger.ref_id == donation_id
    ).delete()

    # CRM Logic: Link/Create Devotee
    devotee = devotee_service.create_or_update_devotee(
        DevoteeCreate(
            devotee_name=payload.devotee_name,
            phone_number=payload.phone_number,
            email=payload.email,
            address=payload.address,
            city=payload.city,
            state=payload.state,
            pincode=payload.pincode
        ),
        db,
        current_user
    )

    # 2. Update Entry Meta
    entry.donation_date = payload.donation_date
    entry.donation_type = _validate_donation_type(payload, db)
    entry.donation_mode = payload.donation_mode
    entry.total_gross_amount = payload.total_gross_amount
    entry.amount_donation_type = payload.amount_donation_type if payload.donation_mode == 1 else None
    entry.donation_amount_master_id = payload.donation_amount_master_id if payload.donation_mode == 1 and payload.amount_donation_type == "SPECIFIC" else None
    entry.amount_note = payload.amount_note if payload.donation_mode == 1 else None
    entry.user_code = current_user.user_code
    entry.devotee_id = devotee.id
    entry.devotee_name = payload.devotee_name
    entry.phone_number = payload.phone_number
    entry.email = payload.email
    entry.address = payload.address
    entry.city = payload.city
    entry.state = payload.state
    entry.pincode = payload.pincode
    entry.remarks = payload.remarks
    entry.updated_at = now
    entry.updated_by = current_user.id

    # 3. Add New Items and Apply New Stock
    for it in (payload.items if payload.donation_mode == 0 else []):
        item = locked_items.get(it.item_id)
        if not item:
            raise HTTPException(status_code=400, detail=f"Invalid item_id: {it.item_id}")

        donation_item = DonationItem(
            donation_entry_id=entry.id,
            item_id=it.item_id,
            quantity=it.quantity,
            created_at=now
        )
        db.add(donation_item)
        
        item.current_stock = Decimal(item.current_stock or 0) + it.quantity
        item.updated_at = now
        item.updated_by = current_user.id

        db.add(StockLedger(
            item_id=item.id,
            txn_date=payload.donation_date,
            txn_type=7,
            ref_table="donation_entries",
            ref_id=entry.id,
            qty_in=it.quantity,
            qty_out=0,
            unit_cost=0,
            value_in=0,
            value_out=0,
            balance=item.current_stock,
            current_value=compute_current_value(db, item.id, Decimal("0"), Decimal("0")),
            created_at=now,
            updated_at=now,
            created_by=current_user.id,
            updated_by=current_user.id
        ))

    db.commit()
    db.refresh(entry)

    # Generate and save receipt PDF automatically
    try:
        pdf_url = generate_and_save_donation_receipt(entry.id, db)
        if pdf_url:
            entry.receipt_pdf_url = pdf_url
            db.commit()
            db.refresh(entry)
    except Exception as e:
        import logging
        logger = logging.getLogger("uvicorn.error")
        logger.error(f"Failed to generate receipt on save: {str(e)}")

    return entry

def delete_donation(donation_id: int, db: Session, current_user: User) -> None:
    now = datetime.now(timezone.utc)
    entry = (
        db.query(DonationEntry)
        .options(joinedload(DonationEntry.items))
        .filter(DonationEntry.id == donation_id, DonationEntry.status == 1)
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Donation not found")

    item_ids = [d_item.item_id for d_item in entry.items]
    locked_items = {
        item.id: item
        for item in db.query(Item).filter(Item.id.in_(item_ids)).order_by(Item.id).with_for_update().all()
    } if item_ids else {}

    for donation_item in entry.items:
        item = locked_items.get(donation_item.item_id)
        if item:
            item.current_stock = Decimal(item.current_stock or 0) - donation_item.quantity
            item.updated_at = now
            item.updated_by = current_user.id

    db.query(StockLedger).filter(
        StockLedger.ref_table == "donation_entries",
        StockLedger.ref_id == donation_id
    ).update({StockLedger.status: 0}, synchronize_session=False)

    entry.status = 0
    entry.updated_at = now
    entry.updated_by = current_user.id
    
    entry.is_deleted = True
    entry.deleted_at = now
    entry.deleted_by_id = current_user.id
    
    db.commit()
