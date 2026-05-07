from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv

load_dotenv(override=True)
DATABASE_URL = os.getenv("DATABASE_URL")

def add_column():
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS session_id VARCHAR(64)"))
        conn.commit()
    print("Column 'session_id' added to 'activity_logs' successfully.")

if __name__ == "__main__":
    add_column()
