from app.db.session import SessionLocal
from app.db.models import SystemSettings

def check_logo():
    db = SessionLocal()
    try:
        settings = db.query(SystemSettings).first()
        if settings:
            print(f"temple_logo: '{settings.temple_logo}'")
        else:
            print("System settings not found.")
    except Exception as e:
        print(f"Error checking logo: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    check_logo()
