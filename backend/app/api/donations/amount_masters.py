from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db, PermissionChecker
from app.db.models import User
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
    payload: DonationAmountMasterCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("donations.amount_config.write")),
):
    return donation_service.create_amount_master(payload, db, current_user)


@router.put("/update_amount_option/{amount_id}", response_model=DonationAmountMasterOut)
def update_amount_option(
    amount_id: int,
    payload: DonationAmountMasterUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("donations.amount_config.write")),
):
    return donation_service.update_amount_master(amount_id, payload, db, current_user)


@router.delete("/delete_amount_option/{amount_id}")
def delete_amount_option(
    amount_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("donations.amount_config.delete")),
):
    donation_service.delete_amount_master(amount_id, db, current_user)
    return {"message": "Amount option disabled"}
