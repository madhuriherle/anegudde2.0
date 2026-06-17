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
    print("--- Roles ---")
    roles = conn.execute(text("SELECT id, role_name, rank_level, module_id, is_all_access FROM roles WHERE status = 1")).fetchall()
    for r in roles:
        print(f"ID: {r[0]} | Name: {r[1]} | Rank: {r[2]} | Module ID: {r[3]} | All Access: {r[4]}")
    
    print("\n--- Modules ---")
    modules = conn.execute(text("SELECT id, name, parent_id, opens_module_id, min_rank_level FROM modules WHERE status = 1")).fetchall()
    for m in modules:
        print(f"ID: {m[0]} | Name: {m[1]} | Parent: {m[2]} | Opens: {m[3]} | Min Rank: {m[4]}")

    print("\n--- Privileges for Module 49 and 12 ---")
    privs = conn.execute(text("SELECT id, privilege_name, module_id FROM privileges WHERE module_id IN (12, 49) AND status = 1")).fetchall()
    for p in privs:
        print(f"ID: {p[0]} | Name: {p[1]} | Module ID: {p[2]}")
