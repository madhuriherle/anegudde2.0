import os
from datetime import datetime, timedelta, timezone
from typing import Any
from jose import jwt
from passlib.context import CryptContext
from cryptography.fernet import Fernet
import bcrypt

# Passlib compatibility fix for bcrypt 4.0+
if not hasattr(bcrypt, "__about__"):
    class BcryptAbout:
        __version__ = bcrypt.__version__
    bcrypt.__about__ = BcryptAbout()

# Password hashing context (Bcrypt)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Fernet Encryption setup for Developer Reference
# The key should be stored in the .env file. 
# Fallback is for initialization, but a real key must be set in production.
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY", "07aN6FtoK67mbjddV48UoEzasCUY2WVHZceeYlbShOQ=")
fernet = Fernet(ENCRYPTION_KEY.encode() if ENCRYPTION_KEY else Fernet.generate_key())

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain text password against a Bcrypt hash."""
    try:
        if not hashed_password:
            return False
            
        # If it's already a bcrypt hash, use bcrypt directly for reliability
        if hashed_password.startswith(('$2a$', '$2b$', '$2y$')):
            return bcrypt.checkpw(plain_password.encode()[:72], hashed_password.encode())
            
        # Fallback for old plain-text passwords
        return plain_password == hashed_password
    except Exception as e:
        print(f"Auth Error: {str(e)}")
        return False

def hash_password(password: str) -> str:
    """Creates a one-way Bcrypt hash of a password."""
    # Bcrypt has a 72-byte limit
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8')[:72], salt).decode('utf-8')

def encrypt_password(password: str) -> str:
    """Two-way encryption for developer reference copy."""
    return fernet.encrypt(password.encode()).decode()

def decrypt_password(encrypted_password: str) -> str:
    """Decrypts the developer reference copy back to plain text."""
    try:
        return fernet.decrypt(encrypted_password.encode()).decode()
    except Exception:
        return "Decryption Failed"

def create_access_token(subject: str, session_id: str | None = None, security_stamp: str | None = None, client_type: str | None = None, expires_minutes: int | None = None) -> str:
    secret_key = os.getenv("SECRET_KEY", "change_me")
    algorithm = os.getenv("ALGORITHM", "HS256")
    payload: dict[str, Any] = {"sub": subject}

    # Only add expiration if specifically requested. 
    # By default, tokens are permanent until the security stamp changes or user logs out.
    if expires_minutes and expires_minutes > 0:
        expire = datetime.now(timezone.utc) + timedelta(minutes=expires_minutes)
        payload["exp"] = expire

    if session_id:
        payload["sid"] = session_id
    if security_stamp:
        payload["ss"] = security_stamp
    if client_type:
        payload["ct"] = client_type
    return jwt.encode(payload, secret_key, algorithm=algorithm)

