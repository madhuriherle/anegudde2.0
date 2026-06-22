import os, sys
sys.path.insert(0, "/var/www/anegudde/backend")
env_path = "/var/www/anegudde/backend/.env"
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line.startswith("DATABASE_URL="):
                os.environ["DATABASE_URL"] = line.split("=", 1)[1]
                break
from sqlalchemy import create_engine, text
engine = create_engine(os.environ["DATABASE_URL"])
with engine.connect() as conn:
    rows = conn.execute(text("SELECT i.id, i.item_name, s.serial_number FROM items i LEFT JOIN item_serial_numbers s ON s.item_id = i.id WHERE i.is_deleted = false ORDER BY i.id")).fetchall()
    for r in rows:
        print(f"  ID={r[0]}, code={r[2]}")
