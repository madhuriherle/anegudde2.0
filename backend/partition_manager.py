import sys
from pathlib import Path
from sqlalchemy import text

# Add the parent directory to the Python path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.db.session import SessionLocal

def manage_partitions():
    print("Starting Token Partition Manager...")
    db = SessionLocal()
    
    # We will create partitions for current year and next year, for each month
    from datetime import datetime, timedelta
    
    current_year = datetime.now().year
    
    try:
        # Check if table exists before trying to create partitions
        result = db.execute(text("SELECT to_regclass('public.token_details')")).scalar()
        if not result:
            print("Table token_details does not exist yet. Please run alembic migrations first.")
            return

        for year in [current_year, current_year + 1]:
            for month in range(1, 13):
                partition_name = f"token_details_{year}_{month:02d}"
                start_date = f"{year}-{month:02d}-01"
                
                if month == 12:
                    end_date = f"{year + 1}-01-01"
                else:
                    end_date = f"{year}-{month + 1:02d}-01"
                    
                sql = f"""
                CREATE TABLE IF NOT EXISTS {partition_name}
                PARTITION OF token_details
                FOR VALUES FROM ('{start_date}') TO ('{end_date}');
                """
                
                db.execute(text(sql))
                db.commit()
                print(f"Ensured partition exists: {partition_name}")
                
        print("Partition management complete.")
        
    except Exception as e:
        print(f"Error managing partitions: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    manage_partitions()
