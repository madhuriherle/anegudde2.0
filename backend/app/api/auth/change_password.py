import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.core.security import encrypt_password, hash_password, verify_password
from app.db.models import User
from app.schemas.auth import PasswordChangeRequest

router = APIRouter()


@router.post("/change_password")
def change_password(
    payload: PasswordChangeRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.current_password, current_user.password):
        raise HTTPException(status_code=400, detail="Incorrect current password")

    current_user.password = hash_password(payload.new_password)
    current_user.password_ref = encrypt_password(payload.new_password)
    current_user.security_stamp = str(uuid.uuid4())
    request.state.audit_meta = {
        "password_updated": True
    }
    db.commit()
    return {"message": "Password updated successfully"}
