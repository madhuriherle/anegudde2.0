import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Find the project root (where .env is)
current_dir = os.path.dirname(os.path.abspath(__file__)) # app/db
project_root = os.path.dirname(os.path.dirname(current_dir)) # backend/
env_path = os.path.join(project_root, '.env')

# Force load the .env
load_dotenv(dotenv_path=env_path, override=True)

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    # Backup: try standard load if the explicit one failed
    load_dotenv(override=True)
    DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError(f"DATABASE_URL not found. Searched at: {env_path}")

engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_recycle=3600, future=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)
