from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.db.models import DonationEntry, Devotee
from datetime import datetime, timezone

def migrate_devotees():
    db = SessionLocal()
    try:
        # Get all donations
        donations = db.query(DonationEntry).all()
        print(f"Found {len(donations)} donations to process.")
        
        devotee_map = {} # phone_number -> Devotee object

        for donation in donations:
            phone = donation.phone_number.strip()
            if not phone:
                continue
                
            if phone not in devotee_map:
                # Check if devotee already exists in DB (maybe from a previous run or manual entry)
                existing = db.query(Devotee).filter(Devotee.phone_number == phone).first()
                if existing:
                    devotee_map[phone] = existing
                else:
                    # Create new devotee
                    new_devotee = Devotee(
                        devotee_name=donation.devotee_name,
                        phone_number=phone,
                        email=donation.email,
                        address=donation.address,
                        status=1,
                        created_at=donation.created_at,
                        updated_at=donation.updated_at,
                        created_by=donation.created_by,
                        updated_by=donation.updated_by
                    )
                    db.add(new_devotee)
                    db.flush() # Get the ID
                    devotee_map[phone] = new_devotee
            
            # Link donation to devotee
            donation.devotee_id = devotee_map[phone].id
            
        db.commit()
        print("Migration complete!")
    except Exception as e:
        print(f"Error during migration: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    migrate_devotees()
