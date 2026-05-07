from app.db.session import SessionLocal
from app.db.models import TokenGeneration, TokenDetail
from datetime import datetime, time, timezone
from sqlalchemy import func

def restore_summaries():
    db = SessionLocal()
    try:
        # Get all generations that don't have details
        gens = db.query(TokenGeneration).all()
        
        max_id = db.query(func.max(TokenDetail.id)).scalar() or 0
        
        for g in gens:
            # Check if details already exist
            count = db.query(TokenDetail).filter(TokenDetail.generation_id == g.id).count()
            if count == 0:
                dt = datetime.combine(g.date, time(10, 0)).replace(tzinfo=timezone.utc)
                max_id += 1
                detail = TokenDetail(
                    id=max_id,
                    generation_id=g.id,
                    token_count=g.total_tokens,
                    created_at=dt,
                    updated_at=dt,
                    created_by=g.created_by or 1,
                    updated_by=g.updated_by or 1
                )
                db.add(detail)
                print(f"Restored 1 entry of {g.total_tokens} tokens for {g.date}")
        
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    restore_summaries()
