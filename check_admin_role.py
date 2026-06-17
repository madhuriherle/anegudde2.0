import sys
import os

# Add the backend directory to sys.path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.db.session import SessionLocal
from app.db.models import User, Role

def check_admin():
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == "admin").first()
        if user:
            role_name = user.role.name if user.role else "None"
            rank = user.role.rank_level if user.role else "None"
            is_all_access = user.role.is_all_access if user.role else "None"
            print(f"Username: {user.username}")
            print(f"Role: {role_name}")
            print(f"Rank: {rank}")
            print(f"All Access: {is_all_access}")
        else:
            print("User 'admin' not found.")
    finally:
        db.close()

if __name__ == "__main__":
    check_admin()
