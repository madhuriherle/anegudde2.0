import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv('backend/.env')
DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_engine(DATABASE_URL)
with engine.connect() as connection:
    result = connection.execute(text("SELECT username, password FROM users WHERE username = 'admin'")).fetchone()
    if result:
        username, password = result
        print(f"Username: {username}")
        print(f"Password in DB: '{password}'")
        print(f"Password length: {len(password)}")
        # Check for whitespace
        if password != password.strip():
            print("WARNING: Password has trailing/leading whitespace!")
    else:
        print("User 'admin' not found")
