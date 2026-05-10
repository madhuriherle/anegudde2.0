from app.db.session import SessionLocal
from app.db.models import TokenDetail, TokenGeneration
from sqlalchemy import func
from datetime import date

db = SessionLocal()
target_date = date(2026, 5, 11)
gen = db.query(TokenGeneration).filter(TokenGeneration.date == target_date).first()

if gen:
    tokens = db.query(func.sum(TokenDetail.token_count)).filter(TokenDetail.generation_id == gen.id).scalar()
    receipts = db.query(TokenDetail).filter(TokenDetail.generation_id == gen.id).count()
    print(f"REPORT FOR {target_date}:")
    print(f"Generation ID: {gen.id}")
    print(f"Total Tokens in Detail table: {tokens}")
    print(f"Total Receipts in Detail table: {receipts}")
    print(f"Saved total_tokens in Generation table: {gen.total_tokens}")
else:
    print(f"No generation found for {target_date}")

db.close()
