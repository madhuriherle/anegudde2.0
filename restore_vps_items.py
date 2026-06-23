import os
import sys
from sqlalchemy import create_engine, text

def safe_print(value):
    encoding = sys.stdout.encoding or "utf-8"
    print(str(value).encode(encoding, errors="replace").decode(encoding, errors="replace"))

def main():
    vps_env = "/var/www/anegudde/backend/.env"
    local_env = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend", ".env")
    
    env_path = None
    if os.path.exists(vps_env):
        env_path = vps_env
        safe_print("Detected environment: VPS")
    elif os.path.exists(local_env):
        env_path = local_env
        safe_print("Detected environment: LOCAL")
    else:
        fallback_env = os.path.join(os.getcwd(), "backend", ".env")
        if os.path.exists(fallback_env):
            env_path = fallback_env
            safe_print("Detected environment: FALLBACK LOCAL")
            
    database_url = None
    if env_path:
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line.startswith("DATABASE_URL="):
                    database_url = line.split("=", 1)[1]
                    break
                    
    if not database_url:
        safe_print("ERROR: DATABASE_URL not found in .env")
        sys.exit(1)
        
    safe_print("Connecting to database...")
    engine = create_engine(database_url)
    
    # Original VPS values before our update:
    restores = [
        (1, 22.00, 4.000),     # Akki
        (3, 0.00, 0.000),      # Bella
        (4, 0.00, 0.000),      # Togari Bele
        (18, 0.00, 0.000),     # Hunase Hannu
        (19, 0.00, 0.000),     # Godi Kadi
        (25, 0.00, 0.000)      # Ona Menasu
    ]
    
    with engine.connect() as conn:
        safe_print("\n--- Performing Revert ---")
        for item_id, target_price, target_stock in restores:
            res = conn.execute(
                text("UPDATE items SET default_price = :price, current_stock = :stock WHERE id = :id"),
                {"price": target_price, "stock": target_stock, "id": item_id}
            )
            safe_print(f"Restored ID={item_id}: {res.rowcount} row(s) updated.")
            
        conn.commit()
        
        safe_print("\n--- Verified Restored State ---")
        for item_id, price, stock in restores:
            r = conn.execute(text("SELECT id, item_name, default_price, current_stock FROM items WHERE id = :id"), {"id": item_id}).fetchone()
            if r:
                safe_print(f"ID={r[0]} | Name={r[1]} | Price={r[2]} | Stock={r[3]}")

if __name__ == "__main__":
    main()
