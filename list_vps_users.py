import sys
import os

# Add the backend directory to sys.path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.db.session import SessionLocal
from app.db.models import User, Role

def list_users():
    db = SessionLocal()
    try:
        users = db.query(User).all()
        print(f"--- Users in Database ({len(users)}) ---")
        for u in users:
            role_name = u.role.role_name if u.role else "None"
            rank = u.role.rank_level if u.role else "None"
            is_all_access = u.role.is_all_access if u.role else "None"
            print(f"Username: {u.username}, Full Name: {u.full_name}, Role: {role_name}, Rank: {rank}, All Access: {is_all_access}")
    finally:
        db.close()

if __name__ == "__main__":
    list_users()
