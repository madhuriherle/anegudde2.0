import os
import sys

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
    database_url = os.environ.get("DATABASE_URL")

if not database_url:
    print("ERROR: Could not find DATABASE_URL")
    sys.exit(1)

from sqlalchemy import create_engine, text

engine = create_engine(database_url)

with engine.connect() as conn:
    result = conn.execute(
        text("UPDATE roles SET role_name = 'Super Admin' WHERE role_name = 'Superadmin'"),
    )
    print(f"Reverted 'Superadmin' -> 'Super Admin' ({result.rowcount} row(s))")

    conn.commit()
    print("Done.")
