from sqlalchemy.orm import Session, joinedload
from app.db.models import Devotee, DonationEntry, DonationItem, Item, User
from app.schemas.devotee import DevoteeCreate, DevoteeUpdate
from datetime import datetime, timezone
from fastapi import HTTPException
from math import ceil
from sqlalchemy import func, or_

def get_devotee_by_phone(phone: str, db: Session) -> Devotee:
    return (
        db.query(Devotee)
        .filter(Devotee.phone_number == phone.strip(), Devotee.status == 1, Devotee.is_deleted == False)
        .order_by(Devotee.updated_at.desc(), Devotee.id.desc())
        .first()
    )

def get_matching_devotee(payload: DevoteeCreate, db: Session) -> Devotee:
    return (
        db.query(Devotee)
        .filter(
            Devotee.phone_number == payload.phone_number.strip(),
            func.lower(Devotee.devotee_name) == payload.devotee_name.strip().lower(),
            Devotee.status == 1,
            Devotee.is_deleted == False,
        )
        .order_by(Devotee.updated_at.desc(), Devotee.id.desc())
        .first()
    )

def get_devotee_details(devotee_id: int, db: Session) -> Devotee:
    devotee = (
        db.query(Devotee)
        .options(
            joinedload(Devotee.donations)
            .joinedload(DonationEntry.items)
            .joinedload(DonationItem.item)
            .joinedload(Item.unit),
            joinedload(Devotee.donations).joinedload(DonationEntry.user),
            joinedload(Devotee.donations).joinedload(DonationEntry.donation_type_master),
            joinedload(Devotee.donations).joinedload(DonationEntry.donation_amount_master),
        )
        .filter(Devotee.id == devotee_id, Devotee.status == 1, Devotee.is_deleted == False)
        .first()
    )
    if devotee:
        devotee.donations = sorted(
            [d for d in devotee.donations if d.status == 1],
            key=lambda d: (d.donation_date, d.id),
            reverse=True,
        )
    return devotee

def list_devotees(db: Session, page: int = 1, page_size: int = 20, q: str = None):
    query = db.query(Devotee).filter(Devotee.status == 1, Devotee.is_deleted == False)

    if q:
        like = f"%{q.strip()}%"
        query = query.filter(
            or_(
                Devotee.devotee_name.ilike(like),
                Devotee.phone_number.ilike(like),
                Devotee.email.ilike(like),
                Devotee.address.ilike(like),
                Devotee.city.ilike(like),
                Devotee.state.ilike(like),
                Devotee.pincode.ilike(like),
            )
        )

    total = query.count()
    devotees = (
        query
        .order_by(Devotee.updated_at.desc(), Devotee.devotee_name.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "items": devotees,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": ceil(total / page_size) if total else 0,
    }

def create_or_update_devotee(payload: DevoteeCreate, db: Session, current_user: User) -> Devotee:
    now = datetime.now(timezone.utc)
    existing = get_matching_devotee(payload, db)
    
    if existing:
        # Update existing info
        existing.devotee_name = payload.devotee_name
        existing.email = payload.email
        existing.address = payload.address
        existing.city = payload.city
        existing.state = payload.state
        existing.pincode = payload.pincode
        existing.updated_at = now
        existing.updated_by = current_user.id
        db.flush()
        return existing
    else:
        # Create new
        new_devotee = Devotee(
            devotee_name=payload.devotee_name,
            phone_number=payload.phone_number.strip(),
            email=payload.email,
            address=payload.address,
            city=payload.city,
            state=payload.state,
            pincode=payload.pincode,
            status=1,
            created_at=now,
            updated_at=now,
            created_by=current_user.id,
            updated_by=current_user.id
        )
        db.add(new_devotee)
        db.flush()
        return new_devotee
