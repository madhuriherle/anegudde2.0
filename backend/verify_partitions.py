import os
from sqlalchemy import create_engine, text
from dotenv import dotenv_values

config = dotenv_values(".env")
url = config.get("DATABASE_URL")
engine = create_engine(url)

with engine.connect() as conn:
    print("\n--- Partition Check ---")
    # This query lists all tables and tells us if they are a 'partitioned table' (p)
    # in PostgreSQL's system catalog.
    result = conn.execute(text("""
        SELECT relname as table_name, 
               CASE relkind 
                 WHEN 'p' THEN 'Partitioned Table (Parent)'
                 WHEN 'r' THEN 'Standard Table'
               END as table_type
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' 
        AND relkind IN ('r', 'p')
        AND relname NOT LIKE 'alembic%'
        ORDER BY table_name;
    """))
    
    found_partition = False
    for row in result:
        print(f"{row.table_name:25} | {row.table_type}")
        if "Partitioned" in row.table_type:
            found_partition = True
            
    if not found_partition:
        print("\n✅ SUCCESS: No partitioned tables found. All tables are Standard.")
    else:
        print("\n⚠️ WARNING: Some tables are still partitioned.")
