from sqlalchemy.orm import Session
from app.db.models import FinancialYear
from fastapi import HTTPException

def get_active_financial_year(db: Session) -> FinancialYear:
    active_year = db.query(FinancialYear).filter(FinancialYear.is_active == True, FinancialYear.status == 1).first()
    if not active_year:
        # Fallback: get the latest one if none marked active
        active_year = db.query(FinancialYear).filter(FinancialYear.status == 1).order_by(FinancialYear.id.desc()).first()
    
    if not active_year:
        raise HTTPException(status_code=500, detail="No active financial year found in system.")
    
    return active_year

def list_financial_years(db: Session):
    return db.query(FinancialYear).filter(FinancialYear.status == 1).order_by(FinancialYear.start_date.desc()).all()
