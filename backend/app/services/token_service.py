from datetime import datetime, timezone, date
import math
from fastapi import HTTPException
from sqlalchemy import func, text
from sqlalchemy.orm import Session, joinedload
from app.db.models import TokenGeneration, TokenDetail, User
from app.schemas.token import TokenDetailCreate

def _ensure_token_partition_for_timestamp(db: Session, ts: datetime) -> None:
    year = ts.year
    month = ts.month
    partition_name = f"token_details_{year}_{month:02d}"
    start_date = f"{year}-{month:02d}-01"
    if month == 12:
        end_date = f"{year + 1}-01-01"
    else:
        end_date = f"{year}-{month + 1:02d}-01"

    db.execute(
        text(
            f"""
            CREATE TABLE IF NOT EXISTS {partition_name}
            PARTITION OF token_details
            FOR VALUES FROM ('{start_date}') TO ('{end_date}');
            """
        )
    )

def create_tokens(payload: TokenDetailCreate, db: Session, current_user: User):
    now = datetime.now(timezone.utc)
    today = now.date()
    _ensure_token_partition_for_timestamp(db, now)

    # 1. Get or Create TokenGeneration for today
    generation = db.query(TokenGeneration).filter(
        TokenGeneration.date == today
    ).first()
    
    if not generation:
        generation = TokenGeneration(
            date=today,
            total_tokens=0,
            created_at=now,
            updated_at=now,
            created_by=current_user.id,
            updated_by=current_user.id
        )
        db.add(generation)
        db.flush()

    # 2. Calculate Manual ID for Partitioned Table
    max_id = db.query(func.max(TokenDetail.id)).scalar() or 0
    next_id = max_id + 1

    # 3. Save TokenDetail (Batch entry)
    new_detail = TokenDetail(
        id=next_id,
        generation_id=generation.id,
        token_count=payload.token_count,
        created_at=now,
        updated_at=now,
        created_by=current_user.id,
        updated_by=current_user.id
    )
    db.add(new_detail)

    # 4. Update Generation Total
    generation.total_tokens += payload.token_count
    generation.updated_at = now
    
    db.commit()
    db.refresh(new_detail)
    return new_detail


def list_token_generations(db: Session, page: int = 1, page_size: int = 20):
    query = db.query(TokenGeneration).options(joinedload(TokenGeneration.creator))
    
    total = query.count()
    offset = (page - 1) * page_size
    items = query.order_by(TokenGeneration.date.desc()).offset(offset).limit(page_size).all()
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": math.ceil(total / page_size) if total > 0 else 0
    }

def get_token_details_by_date(target_date: date, db: Session, page: int = 1, page_size: int = 20):
    generation = db.query(TokenGeneration).filter(TokenGeneration.date == target_date).first()
    if not generation:
        return {
            "items": [],
            "total": 0,
            "page": page,
            "page_size": page_size,
            "total_pages": 0
        }
    
    query = db.query(TokenDetail).options(joinedload(TokenDetail.creator)).filter(TokenDetail.generation_id == generation.id)
    total = query.count()
    offset = (page - 1) * page_size
    items = query.order_by(TokenDetail.created_at.desc()).offset(offset).limit(page_size).all()
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": math.ceil(total / page_size) if total > 0 else 0
    }

def list_all_token_details(db: Session, page: int = 1, page_size: int = 50, start_date: date = None, end_date: date = None):
    query = db.query(TokenDetail).options(joinedload(TokenDetail.creator))
    
    if start_date:
        # Convert date to datetime at start of day
        start_dt = datetime.combine(start_date, datetime.min.time())
        query = query.filter(TokenDetail.created_at >= start_dt)
    
    if end_date:
        # Convert date to datetime at end of day
        end_dt = datetime.combine(end_date, datetime.max.time())
        query = query.filter(TokenDetail.created_at <= end_dt)
        
    total = query.count()
    offset = (page - 1) * page_size
    items = query.order_by(TokenDetail.created_at.desc()).offset(offset).limit(page_size).all()
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": math.ceil(total / page_size) if total > 0 else 0
    }



