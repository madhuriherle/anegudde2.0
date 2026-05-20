import shutil
import os
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session, joinedload
from app.api.deps import get_db, get_current_user, PermissionChecker
from app.db.models import SystemSettings, User
from app.schemas.system_settings import SystemSettingsOut, SystemSettingsUpdate

router = APIRouter(prefix="/settings", tags=["settings"])

@router.get("/get", response_model=SystemSettingsOut)
def get_settings(db: Session = Depends(get_db), current_user: User = Depends(PermissionChecker("settings.read"))):
    settings = db.query(SystemSettings).options(joinedload(SystemSettings.current_year)).first()
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found")
    
    # Map relationship field to schema field
    res = SystemSettingsOut.model_validate(settings)
    if settings.current_year:
        res.financial_year_name = settings.current_year.name
    return res

@router.put("/update", response_model=SystemSettingsOut)
def update_settings(
    settings_in: SystemSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("settings.write"))
):
    # Authorization check - Only Super Admin (1) or Temple Trustee (2)
    if current_user.role_id not in [1, 2]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to update system settings"
        )
        
    settings = db.query(SystemSettings).options(joinedload(SystemSettings.current_year)).first()
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found")
        
    for field, value in settings_in.model_dump().items():
        setattr(settings, field, value)
        
    settings.updated_by = current_user.id
    db.commit()
    db.refresh(settings)
    
    res = SystemSettingsOut.model_validate(settings)
    if settings.current_year:
        res.financial_year_name = settings.current_year.name
    return res

@router.post("/upload-logo")
def upload_logo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("settings.write"))
):
    if current_user.role_id not in [1, 2]:
        raise HTTPException(status_code=403, detail="Permission denied")

    settings = db.query(SystemSettings).first()
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found")

    file_extension = os.path.splitext(file.filename)[1]
    file_path = f"uploads/logos/temple_logo{file_extension}"
    
    os.makedirs("uploads/logos", exist_ok=True)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    settings.temple_logo = f"/{file_path}"
    db.commit()

    return {"logo_url": settings.temple_logo}
