import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv("backend/.env")
DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    print("Listing all tables...")
    res = conn.execute(text("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'"))
    for row in res:
        print(row)

    print("\nChecking purchase_entries count...")
    res = conn.execute(text("SELECT count(*) FROM purchase_entries"))
    print(res.scalar())
    
    try:
        print("\nChecking purchase_bills...")
        res = conn.execute(text("SELECT * FROM purchase_bills"))
        for row in res:
            print(row)
    except Exception as e:
        print(f"Error querying purchase_bills: {e}")
