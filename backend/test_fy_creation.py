import os
from datetime import date
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.db.models import ConsumptionEntry, User, FinancialYear
from app.services.financial_year_service import get_active_financial_year

DATABASE_URL = "postgresql+psycopg2://postgres:123456@localhost:5433/anegudde_inventory"
engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)
db = Session()

try:
    fy = get_active_financial_year(db)
    print(f"Active FY: {fy.id} ({fy.name})")
    
    # Check if a record exists for today
    today = date.today()
    print(f"Today's date: {today}")
    
    # Let's see if there are any records with FY 3
    count = db.query(ConsumptionEntry).filter(ConsumptionEntry.financial_year_id == fy.id).count()
    print(f"Records with FY {fy.id}: {count}")
    
finally:
    db.close()
