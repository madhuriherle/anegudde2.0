from datetime import date, datetime, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.db.models import DonationType, FinancialYear, ReceiptSequence, SystemSettings


TOKEN_SEQUENCE = "TOKEN"
DONATION_SEQUENCE = "DONATION"


def _get_financial_year_for_date(db: Session, target_date: date) -> FinancialYear:
    financial_year = (
        db.query(FinancialYear)
        .filter(
            FinancialYear.start_date <= target_date,
            FinancialYear.end_date >= target_date,
            FinancialYear.status == 1,
        )
        .first()
    )
    if not financial_year:
        raise HTTPException(status_code=400, detail="No active financial year found for receipt date")
    return financial_year


def _get_settings(db: Session) -> SystemSettings:
    settings = db.query(SystemSettings).first()
    if not settings:
        raise HTTPException(status_code=500, detail="System settings not configured")
    return settings


def _format_receipt(prefix: str, number: int, padding: int) -> str:
    return f"{prefix}{str(number).zfill(padding)}"


def _next_sequence_number(
    db: Session,
    financial_year_id: int,
    sequence_type: str,
    prefix: str,
    donation_type_id: int | None = None,
) -> int:
    query = db.query(ReceiptSequence).filter(
        ReceiptSequence.financial_year_id == financial_year_id,
        ReceiptSequence.sequence_type == sequence_type,
    )
    if donation_type_id is None:
        query = query.filter(ReceiptSequence.donation_type_id.is_(None))
    else:
        query = query.filter(ReceiptSequence.donation_type_id == donation_type_id)

    sequence = query.with_for_update().first()
    now = datetime.now(timezone.utc)
    if not sequence:
        sequence = ReceiptSequence(
            financial_year_id=financial_year_id,
            sequence_type=sequence_type,
            donation_type_id=donation_type_id,
            prefix=prefix,
            last_number=0,
            created_at=now,
            updated_at=now,
        )
        db.add(sequence)
        db.flush()
        sequence = (
            db.query(ReceiptSequence)
            .filter(ReceiptSequence.id == sequence.id)
            .with_for_update()
            .first()
        )

    sequence.prefix = prefix
    sequence.last_number += 1
    sequence.updated_at = now
    return sequence.last_number


def next_token_receipt(db: Session, target_date: date) -> tuple[int, str, int, str]:
    settings = _get_settings(db)
    financial_year = _get_financial_year_for_date(db, target_date)
    prefix = settings.token_prefix
    number = _next_sequence_number(db, financial_year.id, TOKEN_SEQUENCE, prefix)
    display_number = _format_receipt(prefix, number, settings.receipt_padding)
    return financial_year.id, prefix, number, display_number


def next_donation_receipt(db: Session, target_date: date, donation_type_id: int) -> tuple[int, str, int, str]:
    settings = _get_settings(db)
    financial_year = _get_financial_year_for_date(db, target_date)
    donation_type = (
        db.query(DonationType)
        .filter(DonationType.id == donation_type_id, DonationType.status == 1)
        .first()
    )
    if not donation_type:
        raise HTTPException(status_code=400, detail="Invalid donation type")

    prefix = donation_type.receipt_prefix
    number = _next_sequence_number(db, financial_year.id, DONATION_SEQUENCE, prefix, donation_type_id)
    display_number = _format_receipt(prefix, number, settings.receipt_padding)
    return financial_year.id, prefix, number, display_number
