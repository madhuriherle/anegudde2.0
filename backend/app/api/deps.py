from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session, joinedload
import os

from app.db.session import SessionLocal
from app.db.models import User, Role, RolePrivilege, Privilege

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(
            token,
            os.getenv("SECRET_KEY", "change_me"),
            algorithms=[os.getenv("ALGORITHM", "HS256")],
        )
        username: str | None = payload.get("sub")
        token_stamp: str | None = payload.get("ss")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = (
        db.query(User)
        .options(
            joinedload(User.role).joinedload(Role.privileges).joinedload(RolePrivilege.privilege)
        )
        .filter(User.username == username)
        .first()
    )
    
    if not user or user.status != 1:
        raise credentials_exception
        
    # Security Stamp Check for session invalidation
    # If the user has a stamp in DB, it must match the one in token
    if user.security_stamp and user.security_stamp != token_stamp:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session invalidated. Please login again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    return user


class PermissionChecker:
    def __init__(self, required_privilege: str):
        self.required_privilege = required_privilege

    def __call__(self, current_user: User = Depends(get_current_user)):
        user_privileges = [
            rp.privilege.privilege_name 
            for rp in (current_user.role.privileges if current_user.role else [])
            if rp.status == 1 and rp.privilege and rp.privilege.status == 1
        ]

        is_all_access = bool(current_user.role and current_user.role.is_all_access)

        if not is_all_access and self.required_privilege not in user_privileges:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Not enough permissions. Required: {self.required_privilege}",
            )

        # Rank-based module restriction check
        # Find the privilege in DB to check its associated module's rank restriction
        db = SessionLocal()
        try:
            priv = db.query(Privilege).options(joinedload(Privilege.module)).filter(
                Privilege.privilege_name == self.required_privilege,
                Privilege.status == 1
            ).first()
            
            if priv and priv.module and priv.module.min_rank_level:
                user_rank = current_user.role.rank_level if current_user.role else 99
                if user_rank > priv.module.min_rank_level:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"This module requires Rank {priv.module.min_rank_level} or higher access.",
                    )
        finally:
            db.close()

        return current_user
