import os
from sqlalchemy import create_engine, text

dbs = ["anegudde_inventory", "anegudde_temple"]

for db_name in dbs:
    db_url = f"postgresql://postgres:123456@localhost:5433/{db_name}"
    print(f"\nChecking database: {db_name}")
    engine = create_engine(db_url)
    with engine.connect() as conn:
        try:
            res = conn.execute(text("SELECT count(*) FROM purchase_entries"))
            print(f"  Purchase Entries: {res.scalar()}")
            
            res = conn.execute(text("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public' AND tablename = 'purchase_bills'"))
            if res.scalar():
                res = conn.execute(text("SELECT count(*) FROM purchase_bills"))
                print(f"  Purchase Bills: {res.scalar()}")
            else:
                print("  Purchase Bills table does NOT exist")
        except Exception as e:
            print(f"  Error: {e}")
