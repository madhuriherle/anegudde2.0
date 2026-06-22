import os, sys
sys.path.insert(0, "/var/www/anegudde/backend")
os.environ.setdefault("DATABASE_URL", "")
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
    r = conn.execute(text("SELECT COUNT(*), COUNT(CASE WHEN default_price != 0 THEN 1 END), COUNT(CASE WHEN current_stock != 0.000 THEN 1 END) FROM items")).fetchone()
    print(f"Total items: {r[0]}")
    print(f"Items with non-zero price: {r[1]}")
    print(f"Items with non-zero stock: {r[2]}")
    if r[1] > 0 or r[2] > 0:
        sample = conn.execute(text("SELECT id, item_name, default_price, current_stock FROM items WHERE default_price != 0 OR current_stock != 0.000 ORDER BY id LIMIT 20")).fetchall()
        for row in sample:
            print(f"  ID={row[0]}, name={row[1]}, price={row[2]}, stock={row[3]}")
    affected_p = conn.execute(text("UPDATE items SET default_price = 0 WHERE default_price != 0")).rowcount
    affected_s = conn.execute(text("UPDATE items SET current_stock = 0.000 WHERE current_stock != 0.000")).rowcount
    conn.commit()
    print(f"\nPrices reset: {affected_p} items")
    print(f"Stock reset: {affected_s} items")
    r2 = conn.execute(text("SELECT COUNT(*), COUNT(CASE WHEN default_price != 0 THEN 1 END), COUNT(CASE WHEN current_stock != 0.000 THEN 1 END) FROM items")).fetchone()
    print(f"\nAfter reset - Total: {r2[0]}, Non-zero price: {r2[1]}, Non-zero stock: {r2[2]}")
