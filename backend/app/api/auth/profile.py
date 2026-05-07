from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, get_financial_year
from app.db.models import User, FinancialYear
from app.schemas.auth import UserOut

router = APIRouter()


@router.get("/me", response_model=UserOut)
def me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    financial_year: FinancialYear = Depends(get_financial_year)
):
    user_out = UserOut.model_validate(current_user)
    user_out.active_financial_year = financial_year
    return user_out
