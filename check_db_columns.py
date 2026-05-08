import os
from sqlalchemy import create_engine, text

db_url = "postgresql://postgres:123456@localhost:5433/anegudde_temple"
print(f"Connecting to: {db_url}")

engine = create_engine(db_url)
with engine.connect() as conn:
    print("\nColumns in consumption_entries:")
    res = conn.execute(text("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'consumption_entries'
        ORDER BY ordinal_position
    """))
    for row in res:
        print(f"  {row[0]}: {row[1]}")
