from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.api.deps import get_db, PermissionChecker
from app.db.models import User, DonationAmountMaster
from app.schemas.donation import DonationAmountMasterCreate, DonationAmountMasterOut, DonationAmountMasterUpdate
from app.services import donation_service

router = APIRouter()


@router.get("/list_amount_options", response_model=list[DonationAmountMasterOut])
def list_amount_options(
    db: Session = Depends(get_db),
    _: User = Depends(PermissionChecker("donations.read")),
    active_only: bool = Query(False),
):
    return donation_service.list_amount_masters(db, active_only=active_only)


@router.post("/create_amount_option", response_model=DonationAmountMasterOut)
def create_amount_option(
    request: Request,
    payload: DonationAmountMasterCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("donations.amount_config.write")),
):
    result = donation_service.create_amount_master(payload, db, current_user)
    request.state.audit_meta = {
        "title": result.title,
        "amount": str(result.amount),
        "snapshot": {"id": result.id, "title": result.title, "amount": str(result.amount)}
    }
    return result


@router.put("/update_amount_option/{amount_id}", response_model=DonationAmountMasterOut)
def update_amount_option(
    request: Request,
    amount_id: int,
    payload: DonationAmountMasterUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("donations.amount_config.write")),
):
    old_row = db.query(DonationAmountMaster).filter(DonationAmountMaster.id == amount_id).first()
    if old_row:
        request.state.audit_meta = {
            "title": old_row.title,
            "amount": str(old_row.amount),
            "snapshot": {"id": old_row.id, "title": old_row.title, "amount": str(old_row.amount)}
        }
    return donation_service.update_amount_master(amount_id, payload, db, current_user)


@router.delete("/delete_amount_option/{amount_id}")
def delete_amount_option(
    amount_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("donations.amount_config.delete")),
):
    row = db.query(DonationAmountMaster).filter(DonationAmountMaster.id == amount_id).first()
    if row:
        request.state.audit_meta = {
            "title": row.title,
            "amount": str(row.amount),
            "snapshot": {"id": row.id, "title": row.title, "amount": str(row.amount)}
        }
    donation_service.delete_amount_master(amount_id, db, current_user)
    return {"message": "Amount option deleted"}
