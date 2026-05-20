import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv('backend/.env')
DATABASE_URL = os.getenv("DATABASE_URL")

from app.db.models import User
from app.core.security import verify_password

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()

username = 'admin'
password_input = '123456'

user = db.query(User).filter(User.username == username).first()

print(f"User found: {user is not None}")
if user:
    print(f"User status: {user.status}")
    print(f"Password in DB: '{user.password}'")
    is_match = verify_password(password_input, user.password)
    print(f"Password match: {is_match}")
    
    if not is_match:
        print(f"Input type: {type(password_input)}, DB type: {type(user.password)}")
        print(f"Input repr: {repr(password_input)}, DB repr: {repr(user.password)}")

db.close()
