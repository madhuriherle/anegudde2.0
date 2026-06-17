import os
import sys
from sqlalchemy import create_engine, text

backend_dir = os.path.join(os.getcwd(), 'backend')
sys.path.append(backend_dir)

# Explicitly load .env
env_vars = {}
with open(os.path.join(backend_dir, '.env'), 'r') as f:
    for line in f:
        if '=' in line:
            key, value = line.strip().split('=', 1)
            env_vars[key] = value

DATABASE_URL = env_vars.get("DATABASE_URL")

engine = create_engine(DATABASE_URL)
with engine.connect() as conn:
    print("--- Hierarchy Check ---")
    res = conn.execute(text("""
        SELECT m1.id, m1.name, m2.name as parent_name 
        FROM modules m1 
        LEFT JOIN modules m2 ON m1.parent_id = m2.id 
        WHERE m1.status = 1 
        ORDER BY m1.parent_id NULLS FIRST, m1.display_order
    """)).fetchall()
    for r in res:
        print(f"ID: {r[0]} | Name: {r[1]} | Parent: {r[2]}")

    print("\n--- Privileges with NULL or suspicious module_id ---")
    res = conn.execute(text("SELECT id, privilege_name, module_id FROM privileges WHERE module_id IS NULL OR module_id NOT IN (SELECT id FROM modules)")).fetchall()
    for r in res:
        print(f"ID: {r[0]} | Name: {r[1]} | Module ID: {r[2]}")

    print("\n--- Roles with scope ---")
    res = conn.execute(text("SELECT id, role_name, module_id FROM roles WHERE status = 1")).fetchall()
    for r in res:
        print(f"ID: {r[0]} | Role: {r[1]} | Scope ID: {r[2]}")
