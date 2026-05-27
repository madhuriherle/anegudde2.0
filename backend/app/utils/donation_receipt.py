from html import escape
import os
import logging
from datetime import datetime
from pathlib import Path
from sqlalchemy.orm import Session, joinedload
from app.db.models import DonationEntry, DonationItem, Item, SystemSettings
from app.utils.pdf_gen import html_to_pdf_with_browser

logger = logging.getLogger("uvicorn.error")

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, "../../.."))

def generate_and_save_donation_receipt(donation_id: int, db: Session) -> str:
    try:
        # 1. Fetch donation details
        donation = db.query(DonationEntry).options(
            joinedload(DonationEntry.items).joinedload(DonationItem.item).joinedload(Item.unit),
            joinedload(DonationEntry.donation_type_master),
            joinedload(DonationEntry.user)
        ).filter(DonationEntry.id == donation_id).first()

        if not donation:
            return None

        # 2. Fetch system settings
        settings = db.query(SystemSettings).first()
        
        logo_path = ""
        # Check for uploaded logo first
        if settings and settings.temple_logo:
             # Strip leading slash if present
            stored_logo = settings.temple_logo.lstrip("/")
            full_logo_path = Path(PROJECT_ROOT) / stored_logo
            if full_logo_path.exists():
                logo_path = full_logo_path.resolve().as_uri()
        
        # Fallback to permanent logo if no uploaded logo
        if not logo_path:
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
        
        # 3. Build items rows
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

        # 4. Build HTML content
        html_content = f"""
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                @page {{
                    size: A5 portrait;
                    margin: 8mm;
                }}
                body {{
                    font-family: "Nirmala UI", "Nirmala", "Segoe UI", Arial, sans-serif;
                    font-size: 8.5pt;
                    line-height: 1.35;
                    color: #2b1d17;
                    margin: 0;
                    padding: 0;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }}
                .receipt-container {{ min-height: 185mm; display: flex; flex-direction: column; padding: 5px; }}
                .header-section {{ text-align: center; border-bottom: 2px solid #5A2D1F; padding-bottom: 8px; margin-bottom: 12px; }}
                .temple-logo {{ height: 50px; margin-bottom: 4px; }}
                .temple-kn {{ font-size: 16pt; font-weight: 800; color: #5A2D1F; margin: 0; }}
                .temple-en {{ font-size: 11pt; font-weight: 800; text-transform: uppercase; margin: 1px 0; color: #5A2D1F; }}
                .temple-info {{ font-size: 8pt; color: #4B4B4B; margin: 1px 0; }}
                
                .receipt-title-box {{ text-align: center; margin: 12px 0; }}
                .receipt-title {{ display: inline-block; font-size: 11pt; font-weight: 900; color: #5A2D1F; border-bottom: 1.5pt solid #5A2D1F; padding-bottom: 2px; text-transform: uppercase; letter-spacing: 0.05em; }}
                
                .details-table {{ width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 8.5pt; }}
                .details-table td {{ padding: 3.5px 0; vertical-align: top; }}
                .label {{ font-weight: 800; color: #5A2D1F; width: 95px; }}
                .separator {{ width: 15px; text-align: center; color: #5A2D1F; font-weight: 800; }}
                .value {{ font-weight: 500; }}
                
                .items-section {{ margin-top: 10px; flex: 1; }}
                .items-header {{ font-size: 8pt; font-weight: 900; color: #5A2D1F; text-transform: uppercase; margin-bottom: 5px; border-bottom: 1px solid #E7D8CC; padding-bottom: 3px; }}
                .items-table {{ width: 100%; border-collapse: collapse; }}
                .items-table td {{ padding: 5px 0; border-bottom: 0.5pt solid #FAF7F2; font-size: 9pt; font-weight: 600; }}
                
                .remarks-box {{ margin-top: 15px; font-size: 8.5pt; font-style: italic; color: #666; border-top: 1px dashed #E7D8CC; padding-top: 8px; }}
                
                .footer-section {{ margin-top: auto; padding-top: 40px; padding-bottom: 10px; display: flex; justify-content: flex-end; }}
                .signature-area {{ text-align: center; width: 180px; }}
                .signature-line {{ border-top: 1pt solid #5A2D1F; margin-bottom: 4px; }}
                .signature-label {{ font-size: 8pt; font-weight: 800; color: #5A2D1F; text-transform: uppercase; }}
                
                .system-footer {{ margin-top: 15px; font-size: 7pt; color: #AAA; text-align: center; border-top: 0.5pt solid #FAF7F2; padding-top: 5px; }}
            </style>
        </head>
        <body>
          <div class="receipt-container">
            <div class="header-section">
                {f'<img src="{logo_path}" class="temple-logo">' if is_visible("show_temple_logo") and logo_path else ''}
                {f'<div class="temple-kn">{escape(temple_name_kn)}</div>' if is_visible("show_temple_name_kn") and temple_name_kn else ''}
                {f'<div class="temple-en">{escape(temple_name)}</div>' if is_visible("show_temple_name") and temple_name else ''}
                {f'<div class="temple-info">{temple_subtitle}</div>' if temple_subtitle else ''}
                {f'<div class="temple-info">{escape(temple_address)}</div>' if is_visible("show_temple_address") and temple_address else ''}
                {f'<div class="temple-info">Contact: {escape(" / ".join(contact_parts))}</div>' if contact_parts else ''}
                {f'<div class="temple-info">Email: {escape(temple_email)}</div>' if is_visible("show_temple_email") and temple_email else ''}
            </div>

            <div class="receipt-title-box">
                <div class="receipt-title">Donation Receipt</div>
            </div>

            <table class="details-table">
                <tr>
                    <td class="label">Receipt No</td>
                    <td class="separator">:</td>
                    <td class="value" style="font-weight: 900; font-size: 10pt;">{donation.receipt_display_number or donation.id}</td>
                    <td class="label" style="text-align: right; width: 60px;">Date</td>
                    <td class="separator">:</td>
                    <td class="value" style="text-align: right; width: 85px;">{donation.donation_date.strftime('%d-%m-%Y')}</td>
                </tr>
                <tr>
                    <td class="label">Donation Type</td>
                    <td class="separator">:</td>
                    <td class="value" colspan="4">{donation.donation_type_master.type_name if donation.donation_type_master else "General Donation"}</td>
                </tr>
                <tr>
                    <td class="label">Devotee Name</td>
                    <td class="separator">:</td>
                    <td class="value" colspan="4" style="font-size: 10pt; font-weight: 800;">{donation.devotee_name}</td>
                </tr>
                <tr>
                    <td class="label">Phone</td>
                    <td class="separator">:</td>
                    <td class="value" colspan="4">{donation.phone_number}</td>
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

            <div class="items-section">
                <div class="items-header">Items Donated</div>
                <table class="items-table">
                    <tbody>
                        {items_rows}
                    </tbody>
                </table>
            </div>

            {f'<div class="remarks-box"><b>Remarks:</b> {donation.remarks}</div>' if donation.remarks else ''}

            <div class="footer-section">
                <div class="signature-area">
                    <div class="signature-line"></div>
                    <div class="signature-label">Authorized Signatory</div>
                </div>
            </div>
            
            <div class="system-footer">
                Generated by AIMS on {datetime.now().strftime('%d-%m-%Y %I:%M %p')}
            </div>
          </div>
        </body>
        </html>
        """

        # 5. Generate PDF
        pdf_bytes = html_to_pdf_with_browser(html_content)
        
        # 6. Save to disk under uploads/receipts/YYYY/MM
        receipt_date = donation.donation_date or datetime.now().date()
        year = str(receipt_date.year)
        month = f"{receipt_date.month:02d}"
        rel_dir = Path("uploads") / "receipts" / year / month
        rel_dir.mkdir(parents=True, exist_ok=True)

        file_name = f"Donation_{donation.id}_{uuid_str()}.pdf"
        rel_path = rel_dir / file_name

        with open(rel_path, "wb") as f:
            f.write(pdf_bytes)

        return f"/{rel_path.as_posix()}"
        
    except Exception as e:
        logger.error(f"Error generating donation receipt: {str(e)}")
        return None

def uuid_str():
    import uuid
    return str(uuid.uuid4())
