from datetime import datetime, timezone, date
from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from app.db.models import TokenGeneration, TokenDetail, User
from app.schemas.token import TokenDetailCreate

def create_tokens(payload: TokenDetailCreate, db: Session, current_user: User):
    now = datetime.now(timezone.utc)
    today = now.date()

    # 1. Get or Create TokenGeneration for today
    generation = db.query(TokenGeneration).filter(TokenGeneration.date == today).first()
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

    # 3. Save TokenDetail
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
    db.refresh(generation)
    return generation

def list_token_generations(db: Session, page: int = 1, page_size: int = 20):
    query = db.query(TokenGeneration).options(joinedload(TokenGeneration.creator)).order_by(TokenGeneration.date.desc())
    return query.offset((page - 1) * page_size).limit(page_size).all()

def get_token_details_by_date(target_date: date, db: Session, page: int = 1, page_size: int = 20):
    generation = db.query(TokenGeneration).filter(TokenGeneration.date == target_date).first()
    if not generation:
        return []
    
    return db.query(TokenDetail).options(joinedload(TokenDetail.creator)).filter(TokenDetail.generation_id == generation.id).order_by(TokenDetail.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

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
        
    return query.order_by(TokenDetail.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()



