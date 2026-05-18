from datetime import datetime, timezone, date
import math
import re
from fastapi import HTTPException
from sqlalchemy import func, text
from sqlalchemy.orm import Session, joinedload
from app.db.models import TokenGeneration, TokenDetail, User
from app.schemas.token import TokenDetailCreate
from app.services.receipt_sequence_service import next_token_receipt

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
    # Use server's local time for business logic consistency
    now_local = datetime.now()
    now_utc = datetime.now(timezone.utc)
    target_date = payload.date or now_local.date()
    
    # Ensure partition exists for the target date's month
    partition_dt = datetime.combine(target_date, datetime.min.time())
    _ensure_token_partition_for_timestamp(db, partition_dt)

    # 1. Get or Create TokenGeneration with a Row Lock
    # Using with_for_update() ensures that concurrent requests for the same date 
    # are queued, preventing race conditions on receipt_number and total_tokens.
    generation = db.query(TokenGeneration).filter(
        TokenGeneration.date == target_date
    ).with_for_update().first()
    
    if not generation:
        generation = TokenGeneration(
            date=target_date,
            total_tokens=0,
            created_at=now_utc,
            updated_at=now_utc,
            created_by=current_user.id,
            updated_by=current_user.id
        )
        db.add(generation)
        db.flush()
        # Re-lock if newly created (PostgreSQL behavior check)
        generation = db.query(TokenGeneration).filter(
            TokenGeneration.id == generation.id
        ).with_for_update().first()

    # 2. Calculate Manual ID for Partitioned Table (Global Max)
    # Note: In a high-traffic system, a Sequence is better than func.max()
    max_id = db.query(func.max(TokenDetail.id)).scalar() or 0
    next_id = max_id + 1

    # 3. Calculate Receipt Number (Scoped to financial year)
    financial_year_id, receipt_prefix, next_receipt, receipt_display_number = next_token_receipt(db, target_date)

    # 4. Save Token Detail
    new_detail = TokenDetail(
        id=next_id,
        generation_id=generation.id,
        financial_year_id=financial_year_id,
        receipt_prefix=receipt_prefix,
        receipt_number=next_receipt,
        receipt_display_number=receipt_display_number,
        token_count=payload.token_count,
        # created_at is the partitioning key, use UTC but keep it consistent
        created_at=now_utc,
        updated_at=now_utc,
        created_by=current_user.id,
        updated_by=current_user.id
    )
    db.add(new_detail)

    # 5. Update Generation Total
    generation.total_tokens += payload.token_count
    generation.updated_at = now_utc
    generation.updated_by = current_user.id
    
    try:
        db.commit()
        db.refresh(new_detail)
        return new_detail
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to issue token: {str(e)}")


def _parse_generation_query_dates(q: str | None) -> tuple[date | None, date | None]:
    if not q:
        return None, None

    date_values = re.findall(r"\d{4}-\d{2}-\d{2}", q)
    if len(date_values) >= 2:
        return date.fromisoformat(date_values[0]), date.fromisoformat(date_values[1])
    if len(date_values) == 1:
        target_date = date.fromisoformat(date_values[0])
        return target_date, target_date
    return None, None


def list_token_generations(db: Session, page: int = 1, page_size: int = 20, q: str | None = None):
    query = db.query(TokenGeneration).options(joinedload(TokenGeneration.creator))
    start_date, end_date = _parse_generation_query_dates(q)

    if start_date:
        query = query.filter(TokenGeneration.date >= start_date)
    if end_date:
        query = query.filter(TokenGeneration.date <= end_date)
    
    total = query.count()
    offset = (page - 1) * page_size
    items = query.order_by(TokenGeneration.date.desc()).offset(offset).limit(page_size).all()
    
    # Refresh totals for each item to ensure they match reality
    for item in items:
        actual_total = db.query(func.coalesce(func.sum(TokenDetail.token_count), 0))\
            .filter(TokenDetail.generation_id == item.id).scalar()
        # Only override if we actually found details, otherwise keep the stored total
        if actual_total > 0:
            item.total_tokens = actual_total
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": math.ceil(total / page_size) if total > 0 else 0
    }

def get_token_details_by_date(target_date: date, db: Session, page: int = 1, page_size: int = 50):
    generation = db.query(TokenGeneration).filter(TokenGeneration.date == target_date).first()
    
    # Calculate totals directly from details for maximum accuracy/sync
    total_tokens = 0
    total_receipts = 0
    
    if generation:
        total_tokens = db.query(func.coalesce(func.sum(TokenDetail.token_count), 0)).filter(TokenDetail.generation_id == generation.id).scalar()
        # Fallback to generation total if no details are found
        if total_tokens == 0:
            total_tokens = generation.total_tokens
        total_receipts = db.query(TokenDetail).filter(TokenDetail.generation_id == generation.id).count()

    if not generation:
        return {
            "items": [],
            "total": 0,
            "total_tokens": 0,
            "page": page,
            "page_size": page_size,
            "total_pages": 0
        }
    
    query = db.query(TokenDetail).options(joinedload(TokenDetail.creator)).filter(TokenDetail.generation_id == generation.id)
    # total in paginated response should be total_receipts
    offset = (page - 1) * page_size
    items = query.order_by(TokenDetail.created_at.desc()).offset(offset).limit(page_size).all()
    
    return {
        "items": items,
        "total": total_receipts,
        "total_tokens": total_tokens,
        "page": page,
        "page_size": page_size,
        "total_pages": math.ceil(total_receipts / page_size) if total_receipts > 0 else 0
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
    
    # Calculate total tokens for the filtered range in a separate, simpler query
    sum_query = db.query(func.coalesce(func.sum(TokenDetail.token_count), 0))
    if start_date:
        sum_query = sum_query.filter(TokenDetail.created_at >= datetime.combine(start_date, datetime.min.time()))
    if end_date:
        sum_query = sum_query.filter(TokenDetail.created_at <= datetime.combine(end_date, datetime.max.time()))
    
    total_tokens = sum_query.scalar()

    offset = (page - 1) * page_size
    items = query.order_by(TokenDetail.created_at.desc()).offset(offset).limit(page_size).all()
    
    return {
        "items": items,
        "total": total,
        "total_tokens": total_tokens,
        "page": page,
        "page_size": page_size,
        "total_pages": math.ceil(total / page_size) if total > 0 else 0
    }



