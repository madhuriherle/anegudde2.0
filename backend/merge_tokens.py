from app.db.session import SessionLocal
from app.db.models import TokenDetail, TokenGeneration
from sqlalchemy import func
from datetime import datetime

db = SessionLocal()
try:
    start_of_day = datetime(2026, 5, 11, 0, 0, 0)
    end_of_day = datetime(2026, 5, 11, 23, 59, 59)
    correct_gen_id = 9

    # 1. Find the misplaced details
    misplaced = db.query(TokenDetail).filter(
        TokenDetail.created_at >= start_of_day,
        TokenDetail.created_at <= end_of_day,
        TokenDetail.generation_id != correct_gen_id
    ).all()

    print(f"Found {len(misplaced)} misplaced records.")

    if misplaced:
        # 2. Update their generation_id
        for detail in misplaced:
            detail.generation_id = correct_gen_id
        
        db.commit()
        print("Successfully merged records into Generation ID 9.")

    # 3. Refresh totals for all generations involved
    all_gen_ids = {1, 9}
    for g_id in all_gen_ids:
        gen = db.query(TokenGeneration).get(g_id)
        if gen:
            actual_total = db.query(func.coalesce(func.sum(TokenDetail.token_count), 0))\
                .filter(TokenDetail.generation_id == g_id).scalar()
            gen.total_tokens = actual_total
            print(f"Updated Generation {g_id}: Total Tokens = {actual_total}")
    
    db.commit()
    print("Database totals synchronized.")

except Exception as e:
    db.rollback()
    print(f"Error during merge: {e}")
finally:
    db.close()
