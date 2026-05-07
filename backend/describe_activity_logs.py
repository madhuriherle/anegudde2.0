import psycopg2
import os
from dotenv import load_dotenv

load_dotenv(override=True)
DATABASE_URL = os.getenv("DATABASE_URL")

def describe_table(table_name):
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    cur.execute(f"""
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = '{table_name}'
        ORDER BY ordinal_position
    """)
    columns = cur.fetchall()
    print(f"Columns in {table_name}:")
    for col in columns:
        print(f"- {col[0]}: {col[1]} (Nullable: {col[2]}, Default: {col[3]})")
    cur.close()
    conn.close()

if __name__ == "__main__":
    describe_table("activity_logs")
