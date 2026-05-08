from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.db.models import Role, User
from app.schemas.user import RoleOut

router = APIRouter()


@router.get("/list_roles", response_model=list[RoleOut])
def list_roles(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(Role).all()
