from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from jose import jwt
import os

from app.api.deps import get_db, get_current_user, oauth2_scheme
from app.db.models import User
from app.utils.audit import log_activity_event

router = APIRouter()

@router.post("/logout", status_code=status.HTTP_200_OK)
def logout(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Log the logout event. The client is responsible for clearing the token.
    """
    client_type = None
    try:
        payload = jwt.decode(
            token,
            os.getenv("SECRET_KEY", "change_me"),
            algorithms=[os.getenv("ALGORITHM", "HS256")],
            options={"verify_exp": False},
        )
        client_type = payload.get("ct")
    except Exception:
        pass

    log_activity_event(
        db,
        user_id=current_user.id,
        client_type=client_type,
        method="POST",
        endpoint="/api/auth/logout",
        action="User Logout",
        activity_status="SUCCESS",
        http_status_code=200,
        meta={"actor_name": current_user.full_name or current_user.username}
    )
    db.commit()
    return {"message": "Logout successful"}
