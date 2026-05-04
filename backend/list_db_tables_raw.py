import psycopg2
import os
from dotenv import load_dotenv

# Force override to use the URL from the .env file
load_dotenv(override=True)
DATABASE_URL = os.getenv("DATABASE_URL")

def list_tables():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
    tables = cur.fetchall()
    print("Tables in Database:")
    for table in sorted(tables):
        print(f"- {table[0]}")
    cur.close()
    conn.close()

if __name__ == "__main__":
    list_tables()
