import os
from sqlalchemy import create_engine, text

DATABASE_URL = "postgresql+psycopg2://postgres:123456@localhost:5433/anegudde_inventory"
engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    print("Fixing consumption_entries...")
    result = conn.execute(text("UPDATE consumption_entries SET financial_year_id = 3 WHERE financial_year_id = 1"))
    print(f"Updated {result.rowcount} rows in consumption_entries.")
    
    print("Fixing wastage_entries...")
    result = conn.execute(text("UPDATE wastage_entries SET financial_year_id = 3 WHERE financial_year_id = 1"))
    print(f"Updated {result.rowcount} rows in wastage_entries.")
    
    print("Fixing stock_ledger...")
    result = conn.execute(text("UPDATE stock_ledger SET financial_year_id = 3 WHERE financial_year_id = 1"))
    print(f"Updated {result.rowcount} rows in stock_ledger.")
    
    conn.commit()
    print("Done.")
