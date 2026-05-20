from html import escape
import os
import logging
from pathlib import Path
import shutil
import subprocess
import traceback
import uuid
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_db, PermissionChecker
from app.db.models import DonationEntry, DonationItem, Item, SystemSettings, User
from app.utils.pdf_gen import html_to_pdf_with_browser

router = APIRouter()
logger = logging.getLogger("uvicorn.error")

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, "../../../.."))

@router.get("/get_receipt_pdf/{donation_id}")
def get_receipt_pdf(
    donation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("donations.read"))
):
    try:
        # 2. Fetch donation details
        donation = db.query(DonationEntry).options(
            joinedload(DonationEntry.items).joinedload(DonationItem.item).joinedload(Item.unit),
            joinedload(DonationEntry.donation_type_master),
            joinedload(DonationEntry.user)
        ).filter(DonationEntry.id == donation_id, DonationEntry.status == 1).first()

        if not donation:
            raise HTTPException(status_code=404, detail="Donation not found")

        # 3. Fetch system settings
        settings = db.query(SystemSettings).first()
        
        logo_path = ""
        permanent_logo = Path(PROJECT_ROOT) / "frontend" / "public" / "temple-logo-permanent.png"
        if permanent_logo.exists():
            logo_path = permanent_logo.resolve().as_uri()

        def is_visible(field_name: str) -> bool:
            return bool(getattr(settings, field_name, True)) if settings else True

        temple_name = settings.temple_name if settings and settings.temple_name else "Anegudde Sri Vinayaka Temple"
        temple_name_kn = settings.temple_name_kn if settings and settings.temple_name_kn else ""
        temple_subtitle = settings.temple_subtitle if settings and settings.temple_subtitle and settings.temple_subtitle.lower() != 'none' else ""
        temple_address = settings.temple_address if settings and settings.temple_address else ""
        temple_contact = settings.temple_contact if settings and settings.temple_contact else ""
        alternate_contact = settings.alternate_contact if settings and settings.alternate_contact else ""
        temple_email = settings.temple_email if settings and settings.temple_email else ""
        temple_website = settings.temple_website if settings and settings.temple_website else ""
        opening_time = settings.opening_time if settings and settings.opening_time else ""
        closing_time = settings.closing_time if settings and settings.closing_time else ""
        google_maps_link = settings.google_maps_link if settings and settings.google_maps_link else ""

        contact_parts = []
        if is_visible("show_temple_contact") and temple_contact:
            contact_parts.append(temple_contact)
        if is_visible("show_alternate_contact") and alternate_contact:
            contact_parts.append(alternate_contact)
        timing_text = " - ".join(part for part in [opening_time, closing_time] if part)
        
        # 4. Build items rows
        items_rows = ""
        for i, it in enumerate(donation.items, 1):
            unit_name = it.item.unit.unit_name if it.item and it.item.unit else ""
            item_name = it.item.item_name if it.item else "Unknown Item"
            qty_val = float(it.quantity) if it.quantity else 0.0
            qty_text = f"{qty_val:g} {unit_name}"
            items_rows += f"""
                <tr>
                    <td class="item-line">{escape(item_name)} - {escape(qty_text)}</td>
                </tr>
            """

        # 5. Build HTML content
        html_content = f"""
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                @page {{
                    size: A5 portrait;
                    margin: 1cm;
                }}
                html, body {{
                    height: 100%;
                }}
                body {{
                    font-family: "Nirmala UI", "Nirmala", "Segoe UI", Arial, sans-serif;
                    font-size: 7.5pt;
                    line-height: 1.28;
                    color: #000;
                    margin: 0;
                    padding: 0;
                }}
                .receipt-page {{ min-height: 180mm; display: flex; flex-direction: column; }}
                .header {{ text-align: center; margin-bottom: 14px; }}
                .temple-name {{ font-size: 14pt; font-weight: bold; margin: 0; }}
                .temple-info {{ font-size: 8.5pt; margin: 2px 0; }}
                .receipt-title {{ text-align: center; font-size: 10pt; font-weight: bold; margin: 14px 0; text-decoration: underline; }}
                .section-table {{ width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 7.5pt; table-layout: fixed; }}
                .section-table td {{ padding: 2.5px 0; vertical-align: top; }}
                .label {{ width: 85px; white-space: nowrap; }}
                .separator {{ width: 12px; text-align: center; }}
                .value {{ word-break: break-word; }}
                .items-table {{ width: 100%; border-collapse: collapse; margin-top: 5px; }}
                .items-table td {{ padding: 3px 4px; border-bottom: none; font-size: 8pt; }}
                .item-line {{ white-space: normal; }}
                .signature-box {{ margin-top: auto; padding-top: 45px; text-align: right; }}
                .signature-text {{ display: inline-block; width: 160px; border-top: 1pt solid #000; text-align: center; padding-top: 5px; }}
            </style>
        </head>
        <body>
          <div class="receipt-page">
            <div class="header">
                {f'<img src="{logo_path}" style="height: 60px; margin-bottom: 5px;">' if logo_path else ''}
                {f'<div class="temple-name">{escape(temple_name_kn)}</div>' if is_visible("show_temple_name_kn") and temple_name_kn else ''}
                {f'<div class="temple-name">{escape(temple_name)}</div>' if is_visible("show_temple_name") and temple_name else ''}
                {f'<div class="temple-info">{temple_subtitle}</div>' if temple_subtitle else ''}
                {f'<div class="temple-info">{escape(temple_address)}</div>' if is_visible("show_temple_address") and temple_address else ''}
                {f'<div class="temple-info">Contact: {escape(" / ".join(contact_parts))}</div>' if contact_parts else ''}
                {f'<div class="temple-info">Timings: {escape(timing_text)}</div>' if is_visible("show_temple_timings") and timing_text else ''}
                {f'<div class="temple-info">Email: {escape(temple_email)}</div>' if is_visible("show_temple_email") and temple_email else ''}
                {f'<div class="temple-info">Website: {escape(temple_website)}</div>' if is_visible("show_temple_website") and temple_website else ''}
                {f'<div class="temple-info">Map: {escape(google_maps_link)}</div>' if is_visible("show_google_maps_link") and google_maps_link else ''}
            </div>

            <div class="receipt-title">DONATION RECEIPT</div>

            <table class="section-table">
                <tr>
                    <td class="label">Receipt No</td>
                    <td class="separator">:</td>
                    <td class="value">{donation.receipt_display_number or donation.id}</td>
                    <td class="label" style="text-align: right; width: 50px;">Date</td>
                    <td class="separator" style="width: 15px;">:</td>
                    <td class="value" style="text-align: right; width: 75px;">{donation.donation_date.strftime('%d-%m-%Y')}</td>
                </tr>
                <tr>
                    <td class="label">Donation Type</td>
                    <td class="separator">:</td>
                    <td class="value" colspan="4">{donation.donation_type_master.type_name if donation.donation_type_master else "General Donation"}</td>
                </tr>
                <tr>
                    <td class="label" style="padding-top: 8px;">Devotee Name</td>
                    <td class="separator" style="padding-top: 8px;">:</td>
                    <td class="value" colspan="4" style="padding-top: 8px;">{donation.devotee_name}</td>
                </tr>
                <tr>
                    <td class="label">Phone</td>
                    <td class="separator">:</td>
                    <td class="value" colspan="4">{donation.phone_number}</td>
                </tr>
                <tr>
                    <td class="label">Email</td>
                    <td class="separator">:</td>
                    <td class="value" colspan="4">{donation.email or '-'}</td>
                </tr>
                <tr>
                    <td class="label">Address</td>
                    <td class="separator">:</td>
                    <td class="value" colspan="4">
                        {donation.address or '-'}
                        {f", {donation.city}" if donation.city else ""}
                        {f", {donation.state}" if donation.state else ""}
                        {f" - {donation.pincode}" if donation.pincode else ""}
                    </td>
                </tr>
            </table>

            <div style="margin-top: 10px; margin-bottom: 5px; font-size: 8pt;">ITEMS DONATED:</div>
            <table class="items-table">
                <tbody>
                    {items_rows}
                </tbody>
            </table>

            {f'<div style="margin-top: 20px;">Remarks: {donation.remarks}</div>' if donation.remarks else ''}

            <div class="signature-box">
                <div class="signature-text">Authorized Signatory</div>
            </div>
          </div>
        </body>
        </html>
        """

        # 6. Generate PDF with Chromium so Kannada text is shaped correctly.
        pdf_bytes = html_to_pdf_with_browser(html_content)
        filename = f"Receipt_{donation.receipt_display_number or donation.id}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Access-Control-Expose-Headers": "Content-Disposition"
            },
        )
        
    except Exception as e:
        logger.error(f"Internal Server Error in get_receipt_pdf: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
