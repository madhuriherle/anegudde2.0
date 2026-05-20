from datetime import date

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.api.deps import get_db, PermissionChecker
from app.db.models import TokenGeneration, User
from app.utils.report_pdf import render_report_pdf, table_html

router = APIRouter()


@router.get("/token-issued/pdf")
def token_issued_report_pdf(
    from_date: date | None = Query(None),
    to_date: date | None = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(PermissionChecker("reports.read")),
):
    query = db.query(TokenGeneration)
    if from_date:
        query = query.filter(TokenGeneration.date >= from_date)
    if to_date:
        query = query.filter(TokenGeneration.date <= to_date)

    rows = query.order_by(TokenGeneration.date.desc()).all()
    total_tokens = sum(int(row.total_tokens or 0) for row in rows)
    body_html = table_html(
        ["Date", "Total Tokens"],
        [[row.date.strftime("%d-%m-%Y"), row.total_tokens] for row in rows] +
        ([["Grand Total", total_tokens]] if rows else []),
        ["left", "right"],
    )
    subtitle_parts = []
    if from_date:
        subtitle_parts.append(f"From {from_date.strftime('%d-%m-%Y')}")
    if to_date:
        subtitle_parts.append(f"To {to_date.strftime('%d-%m-%Y')}")

    pdf_bytes = render_report_pdf(
        db=db,
        title="Token Issued Report",
        subtitle=" | ".join(subtitle_parts) if subtitle_parts else None,
        body_html=body_html,
        orientation="portrait",
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=token_issued_report.pdf"},
    )
