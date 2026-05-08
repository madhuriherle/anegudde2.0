import os
from fastapi import APIRouter
from jose import jwt

router = APIRouter(prefix="/debug", tags=["debug"])

@router.get("/auth-check")
def auth_check():
    sk = os.getenv("SECRET_KEY", "change_me")
    return {
        "secret_key_start": sk[:4] if sk else "None",
        "secret_key_len": len(sk) if sk else 0,
        "env_path": os.path.join(os.getcwd(), ".env"),
        "env_exists": os.path.exists(".env")
    }
