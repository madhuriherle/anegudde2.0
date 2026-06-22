import os
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user, PermissionChecker
from app.db.models import User
from app.services import usage_check_service

router = APIRouter(prefix="/system", tags=["system"])

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PROJECT_ROOT = os.path.dirname(BACKEND_DIR)
def _find_token_app():
    env_path = os.environ.get("TOKEN_APP_PATH")
    if env_path and os.path.exists(env_path):
        return env_path
    candidates = [
        os.path.join(PROJECT_ROOT, "token_desktop_app", "Output", "TokenApp_Setup.exe"),
        os.path.join(BACKEND_DIR, "token_app", "TokenApp_Setup.exe"),
    ]
    for p in candidates:
        if os.path.exists(p):
            return p
    return candidates[0]

TOKEN_APP_FILE = _find_token_app()

@router.get("/token-app/download")
def download_token_app(
    current_user: User = Depends(get_current_user),
):
    if not (current_user.role and current_user.role.rank_level == 1):
        raise HTTPException(status_code=403, detail="Only rank 1 users can download the token app")
    if not os.path.exists(TOKEN_APP_FILE):
        raise HTTPException(status_code=404, detail="Token app installer not found on server")
    return FileResponse(
        TOKEN_APP_FILE,
        media_type="application/octet-stream",
        filename="TokenApp_Setup.exe"
    )

@router.get("/check_usage")
def check_usage(
    entity_type: str = Query(...), # vendor, item, category, etc
    entity_id: int = Query(...),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user)
):
    """
    Checks if an entity has usage in other tables before deletion.
    """
    return usage_check_service.check_entity_usage(entity_type, entity_id, db)
