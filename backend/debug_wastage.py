import os
from sqlalchemy import create_engine, text

DATABASE_URL = "postgresql+psycopg2://postgres:123456@localhost:5433/anegudde_inventory"
engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    print("Wastage Entries:")
    result = conn.execute(text("SELECT id, wastage_date, financial_year_id FROM wastage_entries"))
    for row in result:
        print(row)
