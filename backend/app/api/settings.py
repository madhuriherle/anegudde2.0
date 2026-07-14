import shutil
import os
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Request
from sqlalchemy.orm import Session, joinedload
from app.api.deps import get_db, get_current_user, PermissionChecker
from app.db.models import (
    ActivityLog,
    ConsumptionEntry,
    ConsumptionItem,
    DailyStockSummary,
    Devotee,
    DonationEntry,
    DonationItem,
    ItemPrice,
    LoginHistory,
    MonthlyStockSummary,
    PrinterConfig,
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
    WastageEntry,
    WastageItem,
)
from app.schemas.printer_config import (
    PrinterConfigCreate,
    PrinterConfigUpdate,
    PrinterConfigOut,
    PrinterConfigListOut,
)
from app.schemas.system_settings import (
    DataCleanupSettingsOut,
    ReceiptSettingsUpdate,
    ReceiptSettingsOut,
    SystemSettingsOut,
    TempleIdentitySettingsOut,
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
        StockLedger,
        DailyStockSummary,
        MonthlyStockSummary,
    ],
    "donation_records": [
        Devotee,
        DonationItem,
        DonationEntry,
    ],
    "system_logs": [
        LoginHistory,
        ActivityLog,
    ],
}

def _has_privilege(current_user: User, privilege_name: str) -> bool:
    if not current_user or not current_user.role:
        return False
    if current_user.role.is_all_access:
        return True
    return any(
        rp.status == 1 and rp.privilege and rp.privilege.privilege_name == privilege_name
        for rp in current_user.role.privileges
    )


def _ensure_any_settings_read_access(current_user: User) -> None:
    allowed = [
        "settings.management.read",
        "settings.temple_identity.read",
        "settings.receipt_settings.read",
        "settings.data_cleanup.read",
    ]
    if not any(_has_privilege(current_user, p) for p in allowed):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions. Required one of settings.*.read",
        )


@router.get("/get_current_settings", response_model=SystemSettingsOut)
def get_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    settings = db.query(SystemSettings).options(joinedload(SystemSettings.current_year)).first()
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found")

    return _settings_response(settings)


def _settings_response(settings: SystemSettings) -> SystemSettingsOut:
    res = SystemSettingsOut.model_validate(settings)
    if settings.current_year:
        res.financial_year_name = settings.current_year.name
    # The mpd.txt token file is written here whenever no folder is explicitly configured
    # (see token_service.create_tokens), so surface it as the picker's default location.
    res.effective_token_file_path = settings.token_file_path or os.getcwd()
    return res


def _temple_identity_settings_response(settings: SystemSettings) -> TempleIdentitySettingsOut:
    return TempleIdentitySettingsOut.model_validate(settings)


def _receipt_settings_response(settings: SystemSettings) -> ReceiptSettingsOut:
    return ReceiptSettingsOut.model_validate(settings)


def _data_cleanup_settings_response(settings: SystemSettings) -> DataCleanupSettingsOut:
    return DataCleanupSettingsOut.model_validate(settings)


@router.get("/current", response_model=SystemSettingsOut)
def get_settings_current_alias(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return get_settings(db, current_user)


@router.get("/get", response_model=SystemSettingsOut)
def get_settings_legacy(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return get_settings(db, current_user)


@router.get("/temple-identity", response_model=TempleIdentitySettingsOut)
def get_temple_identity_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("settings.temple_identity.read")),
):
    return _temple_identity_settings_response(_get_settings_or_404(db))


@router.get("/receipt-settings", response_model=ReceiptSettingsOut)
def get_receipt_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("settings.receipt_settings.read")),
):
    return _receipt_settings_response(_get_settings_or_404(db))


@router.get("/data-cleanup", response_model=DataCleanupSettingsOut)
def get_data_cleanup_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("settings.data_cleanup.read")),
):
    if not (current_user.role and current_user.role.rank_level == 1):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Super Admin access required.")
    return _data_cleanup_settings_response(_get_settings_or_404(db))


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
    request: Request,
    settings_in: SystemSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("settings.management.write"))
):
    settings = _get_settings_or_404(db)
    
    request.state.audit_meta = {
        "snapshot": {
            "id": settings.id,
            "temple_name": settings.temple_name,
            "financial_year_id": settings.current_financial_year_id,
        }
    }
    
    for field, value in settings_in.model_dump().items():
        setattr(settings, field, value)
        
    settings.updated_by = current_user.id
    db.commit()
    db.refresh(settings)
    
    return _settings_response(settings)


@router.put("/update_temple_identity_settings", response_model=SystemSettingsOut)
def update_temple_identity_settings(
    request: Request,
    settings_in: TempleIdentitySettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("settings.temple_identity.write"))
):
    settings = _get_settings_or_404(db)
    request.state.audit_meta = {
        "snapshot": {
            "id": settings.id,
            "temple_name": settings.temple_name,
            "temple_address": getattr(settings, 'temple_address', None),
            "temple_phone": getattr(settings, 'temple_phone', None),
        }
    }
    for field, value in settings_in.model_dump().items():
        setattr(settings, field, value)

    settings.updated_by = current_user.id
    db.commit()
    db.refresh(settings)
    return _settings_response(settings)


@router.put("/temple-identity", response_model=SystemSettingsOut)
def update_temple_identity_settings_alias(
    request: Request,
    settings_in: TempleIdentitySettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("settings.temple_identity.write"))
):
    return update_temple_identity_settings(request, settings_in, db, current_user)


@router.put("/update_receipt_settings", response_model=SystemSettingsOut)
def update_receipt_settings(
    request: Request,
    settings_in: ReceiptSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("settings.receipt_settings.write"))
):
    settings = _get_settings_or_404(db)
    request.state.audit_meta = {
        "snapshot": {
            "id": settings.id,
            "receipt_prefix": getattr(settings, 'receipt_prefix', None),
            "receipt_footer": getattr(settings, 'receipt_footer', None),
        }
    }
    for field, value in settings_in.model_dump().items():
        setattr(settings, field, value)

    settings.updated_by = current_user.id
    db.commit()
    db.refresh(settings)
    return _settings_response(settings)


@router.put("/receipt", response_model=SystemSettingsOut)
def update_receipt_settings_alias(
    request: Request,
    settings_in: ReceiptSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("settings.receipt_settings.write"))
):
    return update_receipt_settings(request, settings_in, db, current_user)


@router.post("/clear_operational_data")
def cleanup_operational_data(
    request: Request,
    cleanup_in: OperationalCleanupRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("settings.data_cleanup.write")),
):
    if not (current_user.role and current_user.role.rank_level == 1):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Super Admin access required.")
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

    request.state.audit_meta = {
        "action": "clear_operational_data",
        "snapshot": {"groups": cleanup_in.groups, "deleted_counts": deleted_counts}
    }

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
    request: Request,
    cleanup_in: OperationalCleanupRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("settings.data_cleanup.write")),
):
    if not (current_user.role and current_user.role.rank_level == 1):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Super Admin access required.")
    return cleanup_operational_data(request, cleanup_in, db, current_user)

@router.post("/upload_temple_logo")
def upload_logo(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("settings.temple_identity.write"))
):
    settings = db.query(SystemSettings).first()
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found")

    import time
    file_extension = os.path.splitext(file.filename)[1]
    file_path = f"uploads/logos/temple_logo_{int(time.time())}{file_extension}"
    
    os.makedirs("uploads/logos", exist_ok=True)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    old_logo = settings.temple_logo
    settings.temple_logo = f"/{file_path}"
    db.commit()

    request.state.audit_meta = {
        "snapshot": {"old_logo": old_logo, "new_logo": settings.temple_logo, "filename": file.filename}
    }

    return {"logo_url": settings.temple_logo}


@router.post("/upload-logo")
def upload_logo_legacy(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("settings.temple_identity.write"))
):
    return upload_logo(request, file, db, current_user)



