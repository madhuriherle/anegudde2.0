import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import create_access_token, verify_password
from app.db.models import LoginHistory, User
from app.schemas.auth import LoginRequest, Token


from app.utils.audit import log_activity_event

def login_user(payload: LoginRequest, db: Session) -> Token:
    print(f"DEBUG: Login attempt for username: '{payload.username}'")
    user = db.query(User).filter(User.username == payload.username, User.is_deleted == False).first()
    now = datetime.now(timezone.utc)

    if not user or not verify_password(payload.password, user.password) or user.status != 1:
        db.add(
            LoginHistory(
                user_id=user.id if user else None,
                login_identifier=payload.username,
                login_status="FAILED",
                failure_reason="Invalid credentials",
                logged_in_at=now,
                client_type=payload.client_type,
                created_at=now,
            )
        )
        # Also log to activity_logs for centralized audit
        log_activity_event(
            db,
            user_id=user.id if user else None,
            client_type=payload.client_type,
            method="POST",
            endpoint="/api/auth/login",
            action=f"FAILED Login attempt: {payload.username}",
            activity_status="FAILED",
            reason="Invalid credentials",
            http_status_code=401,
            meta={"username": payload.username}
        )
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")

    session_id = str(uuid.uuid4())
    
    # Set expiration based on client type
    # Web: 24 hours hard limit (frontend will handle the 1-hour inactivity)
    # Desktop: Permanent (None)
    expires_minutes = 1440 if payload.client_type == "web" else None
    
    token = create_access_token(
        subject=user.username, 
        session_id=session_id,
        security_stamp=user.security_stamp,
        client_type=payload.client_type,
        expires_minutes=expires_minutes
    )

    db.add(
        LoginHistory(
            user_id=user.id,
            login_identifier=payload.username,
            login_status="SUCCESS",
            logged_in_at=now,
            session_token=token,
            session_id=session_id,
            client_type=payload.client_type,
            created_at=now,
        )
    )
    # Log to activity_logs for centralized audit
    log_activity_event(
        db,
        user_id=user.id,
        session_id=session_id,
        client_type=payload.client_type,
        method="POST",
        endpoint="/api/auth/login",
        action="SUCCESS Login",
        activity_status="SUCCESS",
        http_status_code=200,
        meta={"actor_name": user.full_name or user.username}
    )
    db.commit()

    return Token(access_token=token)
