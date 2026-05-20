import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv('backend/.env')
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    print("DATABASE_URL not found")
    exit(1)

engine = create_engine(DATABASE_URL)
with engine.connect() as connection:
    result = connection.execute(text("SELECT id, username, status, full_name FROM users"))
    print("Users in database:")
    for row in result:
        print(f"ID: {row[0]}, Username: {row[1]}, Status: {row[2]}, Full Name: {row[3]}")
