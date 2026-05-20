import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv('backend/.env')
DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_engine(DATABASE_URL)
with engine.connect() as connection:
    result = connection.execute(text("SELECT login_identifier, login_status, failure_reason, logged_in_at FROM login_history ORDER BY logged_in_at DESC LIMIT 5"))
    print("Recent login history:")
    for row in result:
        print(f"User: {row[0]}, Status: {row[1]}, Reason: {row[2]}, Time: {row[3]}")
