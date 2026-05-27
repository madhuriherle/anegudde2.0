import os
from datetime import datetime, timedelta, timezone
from typing import Any

from jose import jwt

def verify_password(plain_password: str, hashed_password: str) -> bool:
    # Direct comparison for plain-text passwords as requested.
    return plain_password == hashed_password


def hash_password(password: str) -> str:
    # Returns the password as-is (no hashing) as requested.
    return password


def create_access_token(subject: str, session_id: str | None = None, security_stamp: str | None = None, expires_minutes: int | None = None) -> str:
    secret_key = os.getenv("SECRET_KEY", "change_me")
    algorithm = os.getenv("ALGORITHM", "HS256")
    default_expire = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))
    expire_minutes = expires_minutes if expires_minutes is not None else default_expire

    expire = datetime.now(timezone.utc) + timedelta(minutes=expire_minutes)
    payload: dict[str, Any] = {"sub": subject, "exp": expire}
    if session_id:
        payload["sid"] = session_id
    if security_stamp:
        payload["ss"] = security_stamp
    return jwt.encode(payload, secret_key, algorithm=algorithm)
