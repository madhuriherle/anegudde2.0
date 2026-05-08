import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# load_dotenv('backend/.env')
# DATABASE_URL = os.getenv('DATABASE_URL')
DATABASE_URL = "postgresql+psycopg2://postgres:123456@localhost:5433/anegudde_inventory"
print(f"Connecting to: {DATABASE_URL}")

if not DATABASE_URL:
    print("DATABASE_URL not found in .env")
    exit(1)

engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    result = conn.execute(text("SELECT count(*) FROM consumption_entries"))
    count = result.scalar()
    print(f"Total records in consumption_entries: {count}")
    
    if count > 0:
        print("\nLast 5 records:")
        result = conn.execute(text("SELECT id, usage_date, status, financial_year_id FROM consumption_entries ORDER BY id DESC LIMIT 5"))
        for row in result:
            print(row)
            
    result = conn.execute(text("SELECT count(*) FROM financial_years WHERE is_active = True"))
    fy_count = result.scalar()
    print(f"\nActive financial years: {fy_count}")
    if fy_count > 0:
        result = conn.execute(text("SELECT id, name FROM financial_years WHERE is_active = True"))
        for row in result:
            print(row)
