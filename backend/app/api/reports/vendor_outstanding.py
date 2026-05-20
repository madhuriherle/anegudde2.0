from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, PermissionChecker
from app.db.models import User, Vendor
from app.utils.report_pdf import render_report_pdf, table_html, money

router = APIRouter()


@router.get("/vendor-outstanding")
@router.get("/get_vendor_outstanding")
def vendor_outstanding_report(
    db: Session = Depends(get_db), 
    _: User = Depends(PermissionChecker("reports.read"))
):
    vendors = (
        db.query(Vendor)
        .order_by(Vendor.id.desc())
        .all()
    )
    return [
        {
            "id": v.id,
            "vendor_code": v.vendor_code,
            "vendor_name": v.vendor_name,
            "contact_number": v.contact_number,
            "current_balance": v.opening_balance,
            "credit_limit": None,
        }
        for v in vendors
    ]


@router.get("/vendor-outstanding/pdf")
def vendor_outstanding_report_pdf(
    db: Session = Depends(get_db),
    _: User = Depends(PermissionChecker("reports.read"))
):
    rows = vendor_outstanding_report(db=db, _=_)
    body_html = table_html(
        ["Vendor Code", "Vendor Name", "Contact", "Opening Balance", "Credit Limit"],
        [
            [
                row["vendor_code"] or "-",
                row["vendor_name"] or "-",
                row["contact_number"] or "-",
                money(row["current_balance"]),
                money(row["credit_limit"]) if row["credit_limit"] else "No Limit",
            ]
            for row in rows
        ],
        ["left", "left", "left", "right", "right"],
    )
    pdf_bytes = render_report_pdf(
        db=db,
        title="Vendor Outstanding Report",
        body_html=body_html,
        orientation="landscape",
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=vendor_outstanding_report.pdf"},
    )
