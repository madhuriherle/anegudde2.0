import sqlite3
import os

# Try to find the DB using the DATABASE_URL from .env
from dotenv import load_dotenv
load_dotenv('backend/.env')
db_url = os.getenv("DATABASE_URL")

db_path = 'backend/anegudde.db'
if db_url and db_url.startswith('sqlite:///'):
    db_path = db_url.replace('sqlite:///', '')

print(f"Checking database at: {db_path}")

if not os.path.exists(db_path):
    # Try alternate path
    db_path = 'backend/app/anegudde.db'

if not os.path.exists(db_path):
    print("Database not found.")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("\n--- Items matching 'Hing' or 'Rice' ---")
query = """
SELECT i.id, i.item_name, s.serial_number, i.status
FROM items i 
LEFT JOIN item_serial_numbers s ON i.id = s.item_id 
WHERE i.item_name LIKE '%Hing%' OR i.item_name LIKE '%Rice%' OR s.serial_number = '900' OR s.serial_number = '1';
"""
cursor.execute(query)
rows = cursor.fetchall()
for row in rows:
    print(row)

print("\n--- All items (Top 10) ---")
cursor.execute("SELECT id, item_name FROM items LIMIT 10;")
for row in rows:
    print(row)

conn.close()
