from sqlalchemy import create_engine, inspect
import os
from dotenv import load_dotenv

load_dotenv(override=True)
DATABASE_URL = os.getenv("DATABASE_URL")

def list_columns(table_name):
    engine = create_engine(DATABASE_URL)
    inspector = inspect(engine)
    columns = inspector.get_columns(table_name)
    print(f"Columns in {table_name}:")
    for col in columns:
        print(f"- {col['name']}: {col['type']}")

if __name__ == "__main__":
    list_columns("activity_logs")
