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
            joinedload(DonationEntry.donation_amount_master),
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
        temple_address = settings.temple_address if settings and settings.temple_address else ""
        temple_contact = settings.temple_contact if settings and settings.temple_contact else ""
        alternate_contact = settings.alternate_contact if settings and settings.alternate_contact else ""
        temple_email = settings.temple_email if settings and settings.temple_email else ""
        
        contact_parts = []
        if is_visible("show_temple_contact") and temple_contact:
            contact_parts.append(temple_contact)
        if is_visible("show_alternate_contact") and alternate_contact:
            contact_parts.append(alternate_contact)

        user_code = donation.user_code or (donation.user.user_code if donation.user else "") or "-"

        # 3. Build donation details rows (Physical Receipt Style)
        sl_no = 1
        seva_name = donation.donation_type_master.type_name if donation.donation_type_master else "General Donation"
        
        # Determine Rate and Total
        if donation.donation_type_master and donation.donation_type_master.is_item_donation:
            total_val = 0.0
            rate_val = 0.0
        else:
            total_val = float(donation.total_gross_amount) if donation.total_gross_amount else 0.0
            rate_val = total_val
        
        # Build sub-description text (Items or Notes)
        sub_desc_text = ""
        if donation.donation_mode == 0: # 0: ITEM
            sub_items = []
            for it in donation.items:
                unit_name = it.item.unit.unit_name if it.item and it.item.unit else ""
                item_name = it.item.item_name if it.item else "Unknown Item"
                qty_val = float(it.quantity) if it.quantity else 0.0
                sub_items.append(f"{item_name} - {qty_val:g} {unit_name}")
            sub_desc_text = ", ".join(sub_items)
        else:
            notes = []
            if donation.amount_note: notes.append(donation.amount_note)
            if donation.remarks: notes.append(donation.remarks)
            sub_desc_text = " / ".join(notes)

        items_rows = f"""
            <tr style="height: 8mm;">
                <td style="text-align: center; border-right: 1pt solid #5A2D1F;">{sl_no}</td>
                <td style="border-right: 1pt solid #5A2D1F; font-weight: 800;">{escape(seva_name)}</td>
                <td style="text-align: center; border-right: 1pt solid #5A2D1F;">1</td>
                <td style="text-align: right; border-right: 1pt solid #5A2D1F;">{rate_val:,.2f}</td>
                <td style="text-align: right;">{total_val:,.2f}</td>
            </tr>
        """

        if sub_desc_text:
            items_rows += f"""
                <tr>
                    <td colspan="3" style="padding: 3pt 8pt; font-weight: 700; font-size: 9pt; border-right: 1pt solid #5A2D1F; text-transform: uppercase; line-height: 1.2;">
                        {escape(sub_desc_text)}
                    </td>
                    <td style="border-right: 1pt solid #5A2D1F;"></td>
                    <td></td>
                </tr>
            """

        # 4. Build HTML content
        html_content = f"""
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                @page {{
                    size: A5 landscape;
                    margin: 5mm;
                }}
                body {{
                    font-family: "Nirmala UI", "Nirmala", "Segoe UI", Arial, sans-serif;
                    font-size: 8.5pt;
                    line-height: 1.3;
                    color: #2b1d17;
                    margin: 0;
                    padding: 0;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }}
                .receipt-container {{ 
                    width: 100%;
                    min-height: 120mm; 
                    display: flex; 
                    flex-direction: column; 
                    padding: 10px;
                    background: #fff;
                }}
                
                .header-section {{ text-align: center; margin-bottom: 8px; }}
                .temple-logo {{ height: 45px; margin-bottom: 4px; }}
                .temple-kn {{ font-size: 14pt; font-weight: 800; color: #5A2D1F; margin: 0; }}
                .temple-en {{ font-size: 10pt; font-weight: 800; text-transform: uppercase; margin: 1px 0; color: #5A2D1F; }}
                .temple-info {{ font-size: 7.5pt; color: #4B4B4B; margin: 0; }}
                
                .title-row {{ 
                    display: flex; 
                    justify-content: space-between; 
                    align-items: center; 
                    margin: 5px 0;
                    border-top: 1.5pt solid #5A2D1F;
                    border-bottom: 1.5pt solid #5A2D1F;
                    padding: 4px 0;
                }}
                .receipt-title {{ font-size: 10pt; font-weight: 900; color: #5A2D1F; text-transform: uppercase; }}
                .receipt-title-kn {{ font-size: 11pt; font-weight: 800; color: #5A2D1F; }}
                
                .details-grid {{ 
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 10px;
                    margin-bottom: 10px;
                }}
                .details-table {{ width: 100%; border-collapse: collapse; font-size: 8.5pt; }}
                .details-table td {{ padding: 2px 0; vertical-align: top; }}
                .label {{ font-weight: 800; color: #5A2D1F; width: 85px; }}
                .separator {{ width: 10px; text-align: center; color: #5A2D1F; font-weight: 800; }}
                .value {{ font-weight: 500; }}

                .main-table {{ 
                    width: 100%; 
                    border: 1pt solid #5A2D1F; 
                    border-collapse: collapse; 
                    margin-top: 5px;
                }}
                .main-table th {{ 
                    border: 1pt solid #5A2D1F; 
                    padding: 4px; 
                    background: #FDF8F3; 
                    font-size: 8pt;
                    color: #5A2D1F;
                    text-align: center;
                }}
                .main-table td {{ 
                    padding: 6px 8px; 
                    vertical-align: top; 
                    font-size: 9pt;
                }}
                .sub-description {{ 
                    font-size: 8.5pt; 
                    color: #444; 
                    margin-top: 4px; 
                    padding-left: 10px;
                    font-style: italic;
                    line-height: 1.2;
                }}
                
                .total-row {{ border-top: 1.5pt solid #5A2D1F; font-weight: 900; }}
                .total-label {{ text-align: right; padding-right: 10px; text-transform: uppercase; color: #5A2D1F; }}
                .total-value {{ text-align: right; font-size: 11pt; border-left: 1pt solid #5A2D1F; }}

                .footer-section {{ 
                    margin-top: 20px; 
                    display: flex; 
                    justify-content: space-between; 
                    align-items: flex-end;
                }}
                .signature-area {{ text-align: center; width: 160px; }}
                .signature-line {{ border-top: 1pt solid #5A2D1F; margin-bottom: 4px; }}
                .signature-label {{ font-size: 7.5pt; font-weight: 800; color: #5A2D1F; text-transform: uppercase; }}
                
                .system-footer {{ 
                    margin-top: 10px; 
                    font-size: 7pt; 
                    color: #AAA; 
                    text-align: center; 
                    border-top: 0.5pt solid #EEE; 
                    padding-top: 4px; 
                }}
            </style>
        </head>
        <body>
          <div class="receipt-container">
            <div class="header-section">
                {f'<div class="temple-kn">{escape(temple_name_kn)}</div>' if is_visible("show_temple_name_kn") and temple_name_kn else ''}
                {f'<div class="temple-en">{escape(temple_name)}</div>' if is_visible("show_temple_name") and temple_name else ''}
                {f'<div class="temple-info">{escape(temple_address)}</div>' if is_visible("show_temple_address") and temple_address else ''}
                {f'<div class="temple-info">Contact: {escape(" / ".join(contact_parts))}</div>' if contact_parts else ''}
            </div>

            <div class="title-row">
                <div class="receipt-title-kn">ಸೇವಾ ರಶೀದಿ</div>
                <div class="receipt-title">/ Seva Receipt</div>
                <div style="font-size: 8pt; color: #5A2D1F;">Date: {donation.donation_date.strftime('%d-%m-%Y')}</div>
            </div>

            <div class="details-grid">
                <table class="details-table">
                    <tr>
                        <td class="label">Receipt No</td>
                        <td class="separator">:</td>
                        <td class="value" style="font-weight: 900;">{donation.receipt_display_number or donation.id}</td>
                    </tr>
                    <tr>
                        <td class="label">Name</td>
                        <td class="separator">:</td>
                        <td class="value" style="font-weight: 800; text-transform: uppercase;">{donation.devotee_name}</td>
                    </tr>
                    <tr>
                        <td class="label">Address</td>
                        <td class="separator">:</td>
                        <td class="value">{donation.address or '-'}</td>
                    </tr>
                </table>
                <table class="details-table">
                    <tr>
                        <td class="label">User Code</td>
                        <td class="separator">:</td>
                        <td class="value">{escape(user_code)}</td>
                    </tr>
                    <tr>
                        <td class="label">Phone</td>
                        <td class="separator">:</td>
                        <td class="value">{donation.phone_number or '-'}</td>
                    </tr>
                </table>
            </div>

            <table class="main-table">
                <thead>
                    <tr>
                        <th style="width: 40px;">ಕ್ರ.ಸಂ.<br>Sl.No</th>
                        <th>ಸೇವಾ ವಿವರ<br>Seva Description</th>
                        <th style="width: 60px;">ಪ್ರಮಾಣ<br>Qty</th>
                        <th style="width: 90px;">ದರ<br>Rate</th>
                        <th style="width: 100px;">ಮೊಬಲಗು<br>Amount</th>
                    </tr>
                </thead>
                <tbody>
                    {items_rows}
                    <tr class="total-row">
                        <td colspan="4" class="total-label">TOTAL</td>
                        <td class="total-value">{total_val:,.2f}</td>
                    </tr>
                </tbody>
            </table>

            <div class="footer-section">
                <div style="font-size: 8pt; color: #666; font-style: italic;">
                    {donation.donation_date.strftime('%d-%m-%Y')}
                </div>
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
