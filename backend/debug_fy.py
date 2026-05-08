import os
from sqlalchemy import create_engine, text

DATABASE_URL = "postgresql+psycopg2://postgres:123456@localhost:5433/anegudde_inventory"
engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    print("Financial Years:")
    result = conn.execute(text("SELECT id, name, start_date, end_date, is_active, status FROM financial_years"))
    for row in result:
        print(row)
        
    print("\nConsumption Entries:")
    result = conn.execute(text("SELECT id, usage_date, financial_year_id FROM consumption_entries"))
    for row in result:
        print(row)
