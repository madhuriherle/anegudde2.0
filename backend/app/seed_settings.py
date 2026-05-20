from app.db.session import SessionLocal
from app.db.models import SystemSettings, FinancialYear

def seed_system_settings():
    db = SessionLocal()
    try:
        # Check if settings already exist
        settings = db.query(SystemSettings).first()
        if not settings:
            # Try to get an active financial year
            fy = db.query(FinancialYear).filter(FinancialYear.is_active == True).first()
            
            new_settings = SystemSettings(
                temple_name="Anegudde Sri Vinayaka Temple",
                temple_address="Kumbhashi, Udupi, Karnataka - 576257",
                temple_contact="08254-261257",
                receipt_padding=4,
                current_financial_year_id=fy.id if fy else None
            )
            db.add(new_settings)
            db.commit()
            print("System settings seeded successfully.")
        else:
            print("System settings already exist.")
    except Exception as e:
        db.rollback()
        print(f"Error seeding settings: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_system_settings()
