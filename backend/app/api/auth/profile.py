from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.db.models import User, FinancialYear
from app.schemas.auth import AuthUserOut

router = APIRouter()


@router.get("/get_current_user_profile", response_model=AuthUserOut)
def me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Fetch active financial year
    active_fy = db.query(FinancialYear).filter(FinancialYear.is_active == True, FinancialYear.status == 1).first()
    if not active_fy:
        active_fy = db.query(FinancialYear).filter(FinancialYear.status == 1).order_by(FinancialYear.id.desc()).first()

    user_out = AuthUserOut.model_validate(current_user)
    user_out.active_financial_year = active_fy
    user_out.is_all_access = current_user.role.is_all_access
    user_out.role_rank_level = current_user.role.rank_level if current_user.role else None
    user_out.privileges = [
        rp.privilege.privilege_name 
        for rp in current_user.role.privileges 
        if rp.status == 1
    ]
    return user_out
