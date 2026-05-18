import sqlite3
import os

db_path = os.path.join('backend', 'anegudde.db')
if not os.path.exists(db_path):
    print(f"Database not found at {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

query = """
SELECT i.id, i.item_name, s.serial_number 
FROM items i 
LEFT JOIN item_serial_numbers s ON i.id = s.item_id 
ORDER BY i.id ASC
LIMIT 50;
"""

cursor.execute(query)
rows = cursor.fetchall()

print("ID | Item Name | Serial Number")
print("-" * 40)
for row in rows:
    print(f"{row[0]} | {row[1]} | {row[2]}")

conn.close()
