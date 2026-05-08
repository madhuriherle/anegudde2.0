from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.db.models import User
from app.schemas.auth import AuthUserOut

router = APIRouter()


@router.get("/get_current_user_profile", response_model=AuthUserOut)
def me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_out = AuthUserOut.model_validate(current_user)
    return user_out
