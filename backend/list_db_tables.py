from app.db.session import engine
from sqlalchemy import inspect

def list_tables():
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    print("Tables in Database:")
    for table in sorted(tables):
        print(f"- {table}")

if __name__ == "__main__":
    list_tables()
