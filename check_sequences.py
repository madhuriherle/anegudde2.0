import sys
import os

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from sqlalchemy import text
from app.db.session import SessionLocal

def check_sequences():
    db = SessionLocal()
    try:
        print("Checking receipt_sequences...")
        result = db.execute(text("SELECT id, donation_type_id, last_number FROM receipt_sequences")).fetchall()
        for row in result:
            print(f"ID: {row[0]}, DonationTypeID: {row[1]}, LastNum: {row[2]}")
    finally:
        db.close()

if __name__ == "__main__":
    check_sequences()
