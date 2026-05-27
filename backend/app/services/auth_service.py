import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import create_access_token, verify_password
from app.db.models import LoginHistory, User
from app.schemas.auth import LoginRequest, Token


def login_user(payload: LoginRequest, db: Session) -> Token:
    print(f"DEBUG: Login attempt for username: '{payload.username}'")
    user = db.query(User).filter(User.username == payload.username).first()
    now = datetime.now(timezone.utc)

    if not user:
        print(f"DEBUG: User '{payload.username}' not found in DB")
    elif not verify_password(payload.password, user.password):
        print(f"DEBUG: Password mismatch for user '{payload.username}'. Received: '{payload.password}', Expected: '{user.password}'")
    elif user.status != 1:
        print(f"DEBUG: User '{payload.username}' has status {user.status} (expected 1)")

    if not user or not verify_password(payload.password, user.password) or user.status != 1:
        db.add(
            LoginHistory(
                user_id=user.id if user else None,
                login_identifier=payload.username,
                login_status="FAILED",
                failure_reason="Invalid credentials",
                logged_in_at=now,
                created_at=now,
            )
        )
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")

    session_id = str(uuid.uuid4())
    token = create_access_token(
        subject=user.username, 
        session_id=session_id,
        security_stamp=user.security_stamp
    )

    db.add(
        LoginHistory(
            user_id=user.id,
            login_identifier=payload.username,
            login_status="SUCCESS",
            logged_in_at=now,
            session_token=token,
            session_id=session_id,
            created_at=now,
        )
    )
    db.commit()

    return Token(access_token=token)
