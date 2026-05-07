from app.db.session import SessionLocal
from app.db.models import TokenGeneration, TokenDetail
from datetime import datetime, time, timezone
from sqlalchemy import func

def fix_history():
    db = SessionLocal()
    try:
        # Clear existing details to avoid confusion
        db.query(TokenDetail).delete()
        print("Cleared existing token details.")
        
        # Reset IDs if possible or just get new ones
        max_id = 0
        
        # Get all generations
        gens = db.query(TokenGeneration).all()
        
        for g in gens:
            print(f"Expanding {g.total_tokens} tokens for {g.date}...")
            dt = datetime.combine(g.date, time(10, 0)).replace(tzinfo=timezone.utc)
            
            # Create individual rows
            for _ in range(g.total_tokens):
                max_id += 1
                detail = TokenDetail(
                    id=max_id,
                    generation_id=g.id,
                    token_count=1,
                    created_at=dt,
                    updated_at=dt,
                    created_by=g.created_by or 1,
                    updated_by=g.updated_by or 1
                )
                db.add(detail)
            
            print(f"Finished {g.date}")
            
        db.commit()
        print("Successfully expanded all history into individual token rows.")
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    fix_history()
