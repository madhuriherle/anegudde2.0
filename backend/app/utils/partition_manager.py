import os
from datetime import datetime
from sqlalchemy import text
from app.db.session import SessionLocal

def manage_yearly_partitions():
    """Ensures partitions for the current and next year exist."""
    db = SessionLocal()
    try:
        current_year = datetime.now().year
        years = [current_year, current_year + 1]
        
        tables = [
            "stock_ledger", "purchase_entries", "purchase_items", 
            "consumption_entries", "consumption_items", "wastage_entries", 
            "wastage_items", "stock_adjustments", "vendor_payments", 
            "notifications", "login_history", "daily_stock_summary", 
            "monthly_stock_summary"
        ]

        for y in years:
            start_date = f"{y}-01-01"
            end_date = f"{y + 1}-01-01"
            
            for t in tables:
                partition_name = f"{t}_{y}"
                # The SQL requires single quotes around the date strings
                sql = text(f"CREATE TABLE IF NOT EXISTS {partition_name} PARTITION OF {t} FOR VALUES FROM ('{start_date}') TO ('{end_date}');")
                db.execute(sql)
        
        db.commit()
        print(f"Automated partition check successful for years: {years}")
    except Exception as e:
        print(f"Partition Error: {e}")
        db.rollback()
    finally:
        db.close()
