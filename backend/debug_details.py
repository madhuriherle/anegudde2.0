from app.db.session import SessionLocal
from app.db.models import TokenDetail, TokenGeneration
from sqlalchemy import func
from datetime import datetime, date

db = SessionLocal()
start_of_day = datetime(2026, 5, 11, 0, 0, 0)
end_of_day = datetime(2026, 5, 11, 23, 59, 59)

# Find ALL details created on 11th May
details = db.query(TokenDetail).filter(
    TokenDetail.created_at >= start_of_day,
    TokenDetail.created_at <= end_of_day
).all()

print(f"Total TokenDetail records found for 11th May: {len(details)}")
print(f"Sum of tokens for 11th May: {sum(d.token_count for d in details)}")

# Check for details with different generation_ids
gen_ids = set(d.generation_id for d in details)
print(f"Unique Generation IDs found: {gen_ids}")

db.close()
