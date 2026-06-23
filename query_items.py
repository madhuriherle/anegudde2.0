import os
import sys
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
        print("ERROR: DATABASE_URL not found")
        sys.exit(1)

    engine = create_engine(database_url)
    with engine.connect() as conn:
        res = conn.execute(text("SELECT id, item_name, default_price, current_stock, opening_stock FROM items ORDER BY id")).fetchall()
        print("=== ITEMS IN DB ===")
        for r in res:
            print(f"ID={r[0]} | Name={r[1]} | Price={r[2]} | CurrentStock={r[3]} | OpeningStock={r[4]}")

if __name__ == "__main__":
    main()
