import os
import sys
from sqlalchemy import create_engine, text

env_path = "/var/www/anegudde/backend/.env"
database_url = None
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line.startswith("DATABASE_URL="):
                database_url = line.split("=", 1)[1]
                break

if not database_url:
    sys.exit(1)

engine = create_engine(database_url)

with engine.connect() as conn:
    print("=== LATEST 15 LOGS WHERE client_type = 'desktop' ===")
    sql = """
        SELECT al.id, al.activity_at, al.method, al.endpoint, al.action, al.activity_status, al.client_type, u.username
        FROM activity_logs al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE al.client_type = 'desktop'
        ORDER BY al.activity_at DESC
        LIMIT 15
    """
    res = conn.execute(text(sql)).fetchall()
    for r in res:
        print(f"ID={r[0]} | Time={r[1]} | {r[2]} {r[3]} | Action='{r[4]}' | Status={r[5]} | Client={r[6]} | User={r[7]}")
