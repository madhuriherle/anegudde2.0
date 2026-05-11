from app.db.session import SessionLocal
from app.db.models import TokenDetail
from sqlalchemy import asc

db = SessionLocal()
try:
    gen_id = 9
    # Get all records for today, sorted by creation time
    details = db.query(TokenDetail).filter(TokenDetail.generation_id == gen_id).order_by(asc(TokenDetail.created_at)).all()
    
    print(f"Re-indexing {len(details)} records for Generation {gen_id}...")
    
    for index, detail in enumerate(details, start=1):
        detail.receipt_number = index
        
    db.commit()
    print("Re-indexing complete. Receipt numbers are now 1 through 25.")

except Exception as e:
    db.rollback()
    print(f"Error during re-indexing: {e}")
finally:
    db.close()
