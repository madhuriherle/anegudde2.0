from app.db.session import SessionLocal
from app.db.models import User
db = SessionLocal()
u = db.query(User).filter(User.username == "admin").first()
if u:
    print(f"DEBUG: User exists! Username: {u.username}, Password: {u.password}, Status: {u.status}")
else:
    print("DEBUG: User 'admin' DOES NOT EXIST in the database.")
db.close()
