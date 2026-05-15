from datetime import datetime, timezone
from decimal import Decimal
import math
from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload
from app.db.models import DonationEntry, DonationItem, Item, StockLedger, User, Devotee
from app.schemas.donation import DonationEntryCreate
from app.services import devotee_service
from app.schemas.devotee import DevoteeCreate

def list_donations(db: Session, page: int = 1, page_size: int = 20, q: str = None):
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
        joinedload(DonationEntry.devotee)
    ).filter(DonationEntry.status == 1, DonationEntry.donation_type == 1)

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

def create_donation(payload: DonationEntryCreate, db: Session, current_user: User) -> DonationEntry:
    now = datetime.now(timezone.utc)
    today = now.date()
    
    if payload.donation_date > today:
        raise HTTPException(status_code=400, detail="Donation date cannot be in the future.")

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

    entry = DonationEntry(
        donation_type=payload.donation_type or 1,
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
    
    for it in payload.items:
        # ... (rest of stock update logic)
        item = db.query(Item).filter(Item.id == it.item_id).first()
        if not item:
            raise HTTPException(status_code=400, detail=f"Invalid item_id: {it.item_id}")

        unit_cost = item.default_price or Decimal("0")
        
        donation_item = DonationItem(
            donation_entry_id=entry.id,
            item_id=it.item_id,
            quantity=it.quantity,
            unit_cost_at_time=unit_cost,
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
            unit_cost=unit_cost,
            value_in=it.quantity * unit_cost,
            value_out=0,
            balance=item.current_stock,
            current_value=item.current_stock * unit_cost,
            created_at=now,
            updated_at=now,
            created_by=current_user.id,
            updated_by=current_user.id
        ))

    db.commit()
    db.refresh(entry)
    return entry

def update_donation(donation_id: int, payload: DonationEntryCreate, db: Session, current_user: User) -> DonationEntry:
    now = datetime.now(timezone.utc)
    entry = db.query(DonationEntry).filter(DonationEntry.id == donation_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Donation not found")
    
    # 1. Reverse Previous Stock Changes
    for d_item in entry.items:
        item = db.query(Item).filter(Item.id == d_item.item_id).first()
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
    entry.donation_type = payload.donation_type or 1
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
    for it in payload.items:
        item = db.query(Item).filter(Item.id == it.item_id).first()
        if not item:
            raise HTTPException(status_code=400, detail=f"Invalid item_id: {it.item_id}")

        unit_cost = item.default_price or Decimal("0")
        
        donation_item = DonationItem(
            donation_entry_id=entry.id,
            item_id=it.item_id,
            quantity=it.quantity,
            unit_cost_at_time=unit_cost,
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
            unit_cost=unit_cost,
            value_in=it.quantity * unit_cost,
            value_out=0,
            balance=item.current_stock,
            current_value=item.current_stock * unit_cost,
            created_at=now,
            updated_at=now,
            created_by=current_user.id,
            updated_by=current_user.id
        ))

    db.commit()
    db.refresh(entry)
    return entry
