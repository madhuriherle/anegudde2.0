import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.core.security import encrypt_password, hash_password
from app.db.models import User, FinancialYear
from app.schemas.auth import AuthUserOut, ProfileUpdateRequest

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
    user_out.created_at = current_user.created_at
    user_out.active_financial_year = active_fy
    user_out.is_all_access = current_user.role.is_all_access if current_user.role else False
    user_out.role_name = current_user.role.role_name if current_user.role else None
    user_out.role_rank_level = current_user.role.rank_level if current_user.role else None
    user_out.privileges = [
        rp.privilege.privilege_name 
        for rp in (current_user.role.privileges if current_user.role else [])
        if rp.status == 1 and rp.privilege and rp.privilege.status == 1
    ]
    return user_out


@router.put("/update_profile", response_model=AuthUserOut)
def update_profile(
    payload: ProfileUpdateRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    username = payload.username.strip()
    full_name = payload.full_name.strip()
    email = payload.email.strip() if payload.email else None
    phone = payload.phone.strip() if payload.phone else None

    if not username:
        raise HTTPException(status_code=400, detail="Username is required")
    if not full_name:
        raise HTTPException(status_code=400, detail="Full name is required")

    duplicate = db.query(User).filter(User.username == username, User.id != current_user.id).first()
    if duplicate:
        raise HTTPException(status_code=400, detail="Username already exists")

    current_user.username = username
    current_user.full_name = full_name
    current_user.email = email
    current_user.phone = phone
    if payload.user_code is not None:
        current_user.user_code = payload.user_code.upper().strip() if payload.user_code.strip() else None

    current_user.security_stamp = str(uuid.uuid4())
    current_user.updated_at = datetime.now(timezone.utc)
    current_user.updated_by = current_user.id
    
    # Attach audit metadata
    request.state.audit_meta = {
        "actor_name": current_user.full_name or current_user.username,
        "snapshot": {
            "id": current_user.id,
            "username": current_user.username,
            "full_name": current_user.full_name,
        }
    }
    
    db.commit()
    db.refresh(current_user)
    return me(current_user=current_user, db=db)
