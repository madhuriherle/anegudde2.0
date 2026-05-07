from app.db.session import SessionLocal
from app.db.models import TokenGeneration, TokenDetail
from datetime import datetime, time, timezone

def backfill():
    db = SessionLocal()
    try:
        # Generations for May 5 and May 6
        gens = db.query(TokenGeneration).filter(TokenGeneration.id.in_([1, 2])).all()
        
        # Current max ID in TokenDetail
        # Since it's partitioned, we might need a better way, but for now:
        from sqlalchemy import func
        max_id = db.query(func.max(TokenDetail.id)).scalar() or 0
        
        for g in gens:
            # Check if detail already exists
            existing = db.query(TokenDetail).filter(TokenDetail.generation_id == g.id).first()
            if existing:
                print(f"Details already exist for {g.date}")
                continue
                
            dt = datetime.combine(g.date, time(10, 0)).replace(tzinfo=timezone.utc)
            max_id += 1
            
            detail = TokenDetail(
                id=max_id,
                generation_id=g.id,
                token_count=g.total_tokens,
                created_at=dt,
                updated_at=dt,
                created_by=1,
                updated_by=1
            )
            db.add(detail)
            print(f"Backfilled 1 detail entry for {g.date} (Total: {g.total_tokens})")
        
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    backfill()
