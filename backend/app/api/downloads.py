import json
import os
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from app.api.deps import get_current_user, get_db
from app.db.models import User
from jose import JWTError, jwt
from sqlalchemy.orm import joinedload

router = APIRouter(prefix="/downloads", tags=["Downloads"])

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANUALS_DIR = os.path.join(BASE_DIR, "manuals")
TOKEN_APP_DIR = os.path.join(BASE_DIR, "installers")

TOKEN_APP_FILENAME = "TokenApp_Setup.exe"
PRINTER_AGENT_ZIP_FILENAME = "PrinterAgent.zip"
DESKTOP_APP_MANUAL_FILENAME = "DESKTOP_APP_MANUAL.pdf"

ROLE_MANUAL_MAP = {
    "Super Admin": "SUPER_ADMIN_MANUAL.md",
    "Admin": "ADMIN_MANUAL.md",
    "Temple Trustee": "TRUSTEE_MANUAL.pdf",
    "Manager": "CANTEEN_MANAGER_MANUAL.pdf",
    "Supervisor": "CANTEEN_SUPERVISOR_MANUAL.pdf",
}

MEDIA_TYPES = {
    ".pdf": "application/pdf",
    ".md": "text/markdown",
}


def _manual_name_stem(role_name: str) -> str:
    return "_".join(role_name.lower().split())


def _find_manual_file(role_name: str) -> str | None:
    normalized = _manual_name_stem(role_name)
    expected_names = {
        f"{normalized}_manual.pdf",
        f"{normalized}_manual.md",
        f"{normalized}.pdf",
        f"{normalized}.md",
    }

    if os.path.isdir(MANUALS_DIR):
        for filename in os.listdir(MANUALS_DIR):
            if filename.lower() in expected_names:
                return filename

    return ROLE_MANUAL_MAP.get(role_name)


def _download_name(role_name: str, filename: str) -> str:
    extension = os.path.splitext(filename)[1] or ".pdf"
    return f"{role_name.replace(' ', '_')}_Manual{extension}"


@router.get("/token-app")
def download_token_app(token: str | None = Query(None)):
    if not token:
        raise HTTPException(status_code=401, detail="Token required")
    try:
        payload = jwt.decode(
            token,
            os.getenv("SECRET_KEY", "change_me"),
            algorithms=[os.getenv("ALGORITHM", "HS256")],
            options={"verify_exp": False},
        )
        username = payload.get("sub")
        if not username:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    db = get_db().__next__()
    try:
        user = db.query(User).options(
            joinedload(User.role)
        ).filter(User.username == username, User.is_deleted == False, User.status == 1).first()
        if not user or not (user.role and user.role.rank_level == 1):
            raise HTTPException(status_code=403, detail="Only rank 1 users can download the token app")
    finally:
        db.close()

    filepath = os.path.join(TOKEN_APP_DIR, TOKEN_APP_FILENAME)
    if not os.path.isfile(filepath):
        raise HTTPException(status_code=404, detail="Token app installer not found")

    return FileResponse(
        path=filepath,
        filename=TOKEN_APP_FILENAME,
        media_type="application/octet-stream",
    )


@router.get("/printer-agent")
def download_printer_agent(current_user: User = Depends(get_current_user)):
    """Download the Printer Agent ZIP for installation on any PC."""
    filepath = os.path.join(TOKEN_APP_DIR, PRINTER_AGENT_ZIP_FILENAME)
    if not os.path.isfile(filepath):
        raise HTTPException(status_code=404, detail="Printer Agent installer not found on server")

    return FileResponse(
        path=filepath,
        filename="Anegudde_PrinterAgent.zip",
        media_type="application/zip",
    )


@router.get("/printer-agent-version")
def printer_agent_version(current_user: User = Depends(get_current_user)):
    version_path = os.path.join(TOKEN_APP_DIR, "agent-version.json")
    if not os.path.isfile(version_path):
        raise HTTPException(status_code=404, detail="Version info not found")
    with open(version_path, encoding="utf-8") as f:
        return json.load(f)


@router.get("/manual")
def download_manual(current_user: User = Depends(get_current_user)):
    role_name = current_user.role.role_name if current_user.role else None
    if not role_name:
        raise HTTPException(status_code=404, detail="No manual available (role not assigned)")

    filename = _find_manual_file(role_name)
    if not filename:
        raise HTTPException(status_code=404, detail="No manual available for your role")

    filepath = os.path.join(MANUALS_DIR, filename)
    if not os.path.isfile(filepath):
        raise HTTPException(status_code=404, detail="Manual file not found")

    extension = os.path.splitext(filename)[1].lower()
    return FileResponse(
        path=filepath,
        filename=_download_name(role_name, filename),
        media_type=MEDIA_TYPES.get(extension, "application/octet-stream"),
    )


@router.get("/desktop-app-manual")
def download_desktop_app_manual(_: User = Depends(get_current_user)):
    filepath = os.path.join(MANUALS_DIR, DESKTOP_APP_MANUAL_FILENAME)

    if not os.path.isfile(filepath):
        raise HTTPException(status_code=404, detail="Desktop app manual not found")

    return FileResponse(
        path=filepath,
        filename="Desktop_App_Manual.pdf",
        media_type="application/pdf",
    )
