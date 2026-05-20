from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, PermissionChecker
from app.db.models import User
from app.utils.tasks import audit_stock_integrity

router = APIRouter()


@router.post("/run_stock_audit")
def trigger_audit(db: Session = Depends(get_db), _: User = Depends(PermissionChecker("reports.read"))):
    audit_stock_integrity()
    return {"message": "Stock integrity audit completed. Check logs if any discrepancies were found."}
