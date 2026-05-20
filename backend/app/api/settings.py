import shutil
import os
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session, joinedload
from app.api.deps import get_db, get_current_user, PermissionChecker
from app.db.models import (
    ActivityLog,
    ConsumptionEntry,
    ConsumptionItem,
    DailyStockSummary,
    DonationEntry,
    DonationItem,
    ItemPrice,
    LoginHistory,
    MonthlyStockSummary,
    PurchaseBill,
    PurchaseEntry,
    PurchaseItem,
    PurchaseReturnEntry,
    PurchaseReturnItem,
    StockAdjustment,
    StockLedger,
    SystemSettings,
    TokenDetail,
    TokenGeneration,
    User,
    VendorPayment,
    WastageEntry,
    WastageItem,
)
from app.schemas.system_settings import (
    ReceiptSettingsUpdate,
    SystemSettingsOut,
    SystemSettingsUpdate,
    TempleIdentitySettingsUpdate,
)

router = APIRouter(prefix="/settings", tags=["settings"])


class OperationalCleanupRequest(BaseModel):
    groups: list[str] = Field(default_factory=list, min_length=1)
    confirmation_phrase: str


OPERATIONAL_CLEANUP_GROUPS = {
    "canteen_tokens": [
        TokenDetail,
        TokenGeneration,
    ],
    "inventory_transactions": [
        WastageItem,
        WastageEntry,
        StockAdjustment,
        ConsumptionItem,
        ConsumptionEntry,
        PurchaseReturnItem,
        PurchaseReturnEntry,
        ItemPrice,
        PurchaseBill,
        PurchaseItem,
        PurchaseEntry,
        VendorPayment,
        StockLedger,
        DailyStockSummary,
        MonthlyStockSummary,
    ],
    "donation_records": [
        DonationItem,
        DonationEntry,
    ],
    "system_logs": [
        LoginHistory,
        ActivityLog,
    ],
}

@router.get("/get_current_settings", response_model=SystemSettingsOut)
def get_settings(db: Session = Depends(get_db), current_user: User = Depends(PermissionChecker("settings.read"))):
    settings = db.query(SystemSettings).options(joinedload(SystemSettings.current_year)).first()
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found")
    
    # Map relationship field to schema field
    res = SystemSettingsOut.model_validate(settings)
    if settings.current_year:
        res.financial_year_name = settings.current_year.name
    return res


def _settings_response(settings: SystemSettings) -> SystemSettingsOut:
    res = SystemSettingsOut.model_validate(settings)
    if settings.current_year:
        res.financial_year_name = settings.current_year.name
    return res


@router.get("/current", response_model=SystemSettingsOut)
def get_settings_current_alias(db: Session = Depends(get_db), current_user: User = Depends(PermissionChecker("settings.read"))):
    return get_settings(db, current_user)


@router.get("/get", response_model=SystemSettingsOut)
def get_settings_legacy(db: Session = Depends(get_db), current_user: User = Depends(PermissionChecker("settings.read"))):
    return get_settings(db, current_user)


def _get_settings_or_404(db: Session) -> SystemSettings:
    settings = db.query(SystemSettings).options(joinedload(SystemSettings.current_year)).first()
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found")
    return settings


def _ensure_all_access(current_user: User) -> None:
    if not current_user.role.is_all_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to update system settings"
        )

@router.put("/update", response_model=SystemSettingsOut)
def update_settings(
    settings_in: SystemSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("settings.write"))
):
    # Authorization check - Only All-Access roles (Temple Trustee)
    _ensure_all_access(current_user)
        
    settings = _get_settings_or_404(db)
        
    for field, value in settings_in.model_dump().items():
        setattr(settings, field, value)
        
    settings.updated_by = current_user.id
    db.commit()
    db.refresh(settings)
    
    return _settings_response(settings)


@router.put("/update_temple_identity_settings", response_model=SystemSettingsOut)
def update_temple_identity_settings(
    settings_in: TempleIdentitySettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("settings.write"))
):
    _ensure_all_access(current_user)

    settings = _get_settings_or_404(db)
    for field, value in settings_in.model_dump().items():
        setattr(settings, field, value)

    settings.updated_by = current_user.id
    db.commit()
    db.refresh(settings)
    return _settings_response(settings)


@router.put("/temple-identity", response_model=SystemSettingsOut)
def update_temple_identity_settings_alias(
    settings_in: TempleIdentitySettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("settings.write"))
):
    return update_temple_identity_settings(settings_in, db, current_user)


@router.put("/update_receipt_settings", response_model=SystemSettingsOut)
def update_receipt_settings(
    settings_in: ReceiptSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("settings.write"))
):
    _ensure_all_access(current_user)

    settings = _get_settings_or_404(db)
    settings.receipt_padding = settings_in.receipt_padding
    settings.updated_by = current_user.id
    db.commit()
    db.refresh(settings)
    return _settings_response(settings)


@router.put("/receipt", response_model=SystemSettingsOut)
def update_receipt_settings_alias(
    settings_in: ReceiptSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("settings.write"))
):
    return update_receipt_settings(settings_in, db, current_user)


@router.post("/clear_operational_data")
def cleanup_operational_data(
    cleanup_in: OperationalCleanupRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("settings.write")),
):
    if not current_user.role.is_all_access:
        raise HTTPException(status_code=403, detail="Permission denied")

    if cleanup_in.confirmation_phrase != "CLEAR DATA":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Type CLEAR DATA exactly to confirm",
        )

    unknown_groups = sorted(set(cleanup_in.groups) - set(OPERATIONAL_CLEANUP_GROUPS))
    if unknown_groups:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown cleanup group: {', '.join(unknown_groups)}",
        )

    deleted_counts: dict[str, int] = {}

    try:
        for group in cleanup_in.groups:
            for model in OPERATIONAL_CLEANUP_GROUPS[group]:
                table_name = model.__tablename__
                deleted_counts[table_name] = deleted_counts.get(table_name, 0) + db.query(model).delete(
                    synchronize_session=False
                )

        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Cleanup failed: {str(exc)}",
        ) from exc

    return {
        "message": "Operational data cleared successfully",
        "deleted_counts": deleted_counts,
        "protected_master_data": [
            "items",
            "menu_items",
            "item_categories",
            "units",
            "vendors",
            "donation_types",
            "system_settings",
            "users",
            "roles",
            "privileges",
            "financial_years",
            "receipt_sequences",
        ],
    }


@router.post("/cleanup-operational-data")
def cleanup_operational_data_alias(
    cleanup_in: OperationalCleanupRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("settings.write")),
):
    return cleanup_operational_data(cleanup_in, db, current_user)

@router.post("/upload_temple_logo")
def upload_logo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("settings.write"))
):
    if not current_user.role.is_all_access:
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


@router.post("/upload-logo")
def upload_logo_legacy(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("settings.write"))
):
    return upload_logo(file, db, current_user)
