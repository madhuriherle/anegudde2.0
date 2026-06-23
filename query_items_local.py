import os
import sys
from sqlalchemy import create_engine, text

def main():
    env_path = os.path.join(os.path.dirname(__file__), "backend", ".env")
    database_url = None
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line.startswith("DATABASE_URL="):
                    database_url = line.split("=", 1)[1]
                    break

    if not database_url:
        print("ERROR: DATABASE_URL not found in local .env")
        sys.exit(1)

    print(f"Connecting to local DB: {database_url}")
    engine = create_engine(database_url)
    try:
        with engine.connect() as conn:
            res = conn.execute(text("SELECT id, item_name, default_price, current_stock, opening_stock FROM items ORDER BY id")).fetchall()
            with open("local_items.txt", "w", encoding="utf-8") as f:
                f.write("=== LOCAL DB ITEMS ===\n")
                for r in res:
                    f.write(f"ID={r[0]} | Name={r[1]} | Price={r[2]} | CurrentStock={r[3]} | OpeningStock={r[4]}\n")
            print("Successfully written to local_items.txt")
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    main()
