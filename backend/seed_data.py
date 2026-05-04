import os
from datetime import datetime
from dotenv import load_dotenv

load_dotenv(override=True)

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db.models import Role, User, Unit, ItemCategory
from app.core.security import hash_password

DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def seed():
    db = SessionLocal()
    try:
        roles_data = [{"role_name": "SuperAdmin"}, {"role_name": "Admin"}, {"role_name": "Manager"}, {"role_name": "Staff"}]
        for r in roles_data:
            if not db.query(Role).filter(Role.role_name == r["role_name"]).first():
                db.add(Role(role_name=r["role_name"], status=1))
        db.commit()

        sa_role = db.query(Role).filter(Role.role_name == "SuperAdmin").first()
        if sa_role and not db.query(User).filter(User.username == "admin").first():
            db.add(User(username="admin", password=hash_password("admin123"), role_id=sa_role.id, full_name="System Administrator", status=1))
            db.commit()
            print("SuperAdmin created (admin / admin123)")

        for u in [{"n": "Kilogram", "c": "KG"}, {"n": "Litre", "c": "LTR"}, {"n": "Piece", "c": "PCS"}]:
            if not db.query(Unit).filter(Unit.unit_code == u["c"]).first():
                db.add(Unit(unit_name=u["n"], unit_code=u["c"], status=1))
        
        for c in ["Groceries", "Vegetables", "Cleaning"]:
            if not db.query(ItemCategory).filter(ItemCategory.category_name == c).first():
                db.add(ItemCategory(category_name=c, status=1))
        
        db.commit()
        print("Database seeding completed successfully.")

    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed()
