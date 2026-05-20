import os
import io
import sys

# Add backend directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from datetime import datetime
from sqlalchemy.orm import Session, joinedload
from xhtml2pdf import pisa
from app.db.session import SessionLocal
from app.db.models import DonationEntry, DonationItem, Item, SystemSettings, User

def test_pdf(donation_id):
    db = SessionLocal()
    try:
        donation = db.query(DonationEntry).options(
            joinedload(DonationEntry.items).joinedload(DonationItem.item).joinedload(Item.unit),
            joinedload(DonationEntry.donation_type_master),
            joinedload(DonationEntry.user)
        ).filter(DonationEntry.id == donation_id).first()

        if not donation:
            print(f"Donation {donation_id} not found")
            return

        settings = db.query(SystemSettings).first()
        
        logo_path = ""
        if settings and settings.temple_logo:
            clean_logo_path = settings.temple_logo.lstrip("/")
            if os.path.exists(clean_logo_path):
                logo_path = os.path.abspath(clean_logo_path).replace("\\", "/")

        temple_name = settings.temple_name if settings and settings.temple_name else "Anegudde Sri Vinayaka Temple"
        temple_subtitle = settings.temple_subtitle if settings and settings.temple_subtitle and settings.temple_subtitle.lower() != 'none' else ""
        temple_address = settings.temple_address if settings and settings.temple_address else ""
        temple_contact = settings.temple_contact if settings and settings.temple_contact else ""
        
        font_path = "C:/Windows/Fonts/ebrima.ttf"
        if not os.path.exists(font_path):
            font_path = "C:/Windows/Fonts/arial.ttf"
        font_path = font_path.replace("\\", "/")

        items_rows = ""
        for i, it in enumerate(donation.items, 1):
            unit_name = it.item.unit.unit_name if it.item and it.item.unit else ""
            item_name = it.item.item_name if it.item else "Unknown Item"
            qty_val = float(it.quantity) if it.quantity else 0.0
            items_rows += f"<tr><td>{i}</td><td>{item_name}</td><td align='right'>{qty_val:g} {unit_name}</td></tr>"

        html_content = f"""
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                @page {{ size: A5 portrait; margin: 1cm; }}
                body {{ font-family: Helvetica, Arial, sans-serif; font-size: 10pt; }}
            </style>
        </head>
        <body>
            <h1>{temple_name}</h1>
            <p>{temple_subtitle}</p>
            <hr/>
            <p>Receipt No: {donation.receipt_display_number or donation.id}</p>
            <p>Date: {donation.donation_date}</p>
            <p>Devotee: {donation.devotee_name}</p>
            <table>{items_rows}</table>
        </body>
        </html>
        """

        print("HTML content prepared. Starting PDF generation...")
        result = io.BytesIO()
        pisa_status = pisa.CreatePDF(io.BytesIO(html_content.encode("utf-8")), dest=result)
        
        if not pisa_status.err:
            with open(f"test_receipt_{donation_id}.pdf", "wb") as f:
                f.write(result.getvalue())
            print(f"Successfully generated test_receipt_{donation_id}.pdf")
        else:
            print(f"PDF Error Code: {pisa_status.err}")
            
    except Exception as e:
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    test_pdf(8)
