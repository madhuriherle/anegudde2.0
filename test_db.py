import sys
import os
from sqlalchemy import create_engine, text

def main():
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
        print("ERROR: DATABASE_URL not found in remote .env")
        sys.exit(1)
        
    print(f"Connecting to database: {database_url}")
    try:
        engine = create_engine(database_url)
        with engine.connect() as conn:
            res = conn.execute(text("SELECT id, username, is_deleted, status FROM users ORDER BY id")).fetchall()
            print("Successfully connected. Users:")
            for r in res:
                print(f"  ID={r[0]}, Username={r[1]}, is_deleted={r[2]}, status={r[3]}")
    except Exception as e:
        print("CONNECTION ERROR:")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
