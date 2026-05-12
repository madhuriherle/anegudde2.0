from datetime import date, datetime
import io

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
from xhtml2pdf import pisa

from app.api.deps import get_current_user, get_db
from app.db.models import User
from .stock_finance_card import stock_finance_card

router = APIRouter()


@router.get("/get_stock_finance_pdf")
def stock_finance_pdf(
    from_date: date = Query(...),
    to_date: date = Query(...),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user)
):
    data = stock_finance_card(from_date=from_date, to_date=to_date, group_by="day", db=db, _=_)

    html_content = f"""
    <html>
    <head><style>
    @page {{ size: A4 landscape; margin: 1cm; }}
    body {{ font-family: Helvetica, Arial, sans-serif; font-size: 10pt; color: #333; }}
    h1 {{ text-align: center; color: #1a237e; }}
    h2 {{ text-align: center; color: #555; margin-bottom: 20px; }}
    table {{ width: 100%; border-collapse: collapse; margin-top: 10px; }}
    th {{ background-color: #1a237e; color: white; padding: 8px; text-align: left; border: 1px solid #ddd; }}
    td {{ padding: 6px; border: 1px solid #ddd; }}
    tr:nth-child(even) {{ background-color: #f2f2f2; }}
    .text-right {{ text-align: right; }}
    .footer {{ position: fixed; bottom: 0; width: 100%; text-align: center; font-size: 8pt; color: #777; }}
    .summary {{ margin-top: 20px; padding: 10px; border: 1px solid #1a237e; background-color: #e8eaf6; }}
    </style></head>
    <body>
    <h1>Anegudde Sri Vinayaka Temple</h1>
    <h2>Inventory Stock & Financial Report ({from_date.strftime('%d-%m-%Y')} to {to_date.strftime('%d-%m-%Y')})</h2>
    <table><thead><tr>
    <th>Period</th><th class="text-right">Opening</th><th class="text-right">Purchased</th><th class="text-right">Consumed</th><th class="text-right">Wastage</th><th class="text-right">Closing</th><th class="text-right">Purchase Val</th><th class="text-right">Payment Val</th><th class="text-right">Balance</th>
    </tr></thead><tbody>
    """

    for row in data:
        html_content += f"""
        <tr>
            <td>{row.period}</td>
            <td class="text-right">{row.opening_stock:.2f}</td>
            <td class="text-right">+{row.purchased_qty:.2f}</td>
            <td class="text-right">-{row.consumed_qty:.2f}</td>
            <td class="text-right">-{row.wastage_qty:.2f}</td>
            <td class="text-right"><strong>{row.closing_stock:.2f}</strong></td>
            <td class="text-right">Rs. {row.purchase_value:,.2f}</td>
            <td class="text-right">Rs. {row.vendor_payment_value:,.2f}</td>
            <td class="text-right">Rs. {row.net_financial_balance:,.2f}</td>
        </tr>
        """

    html_content += """
            </tbody></table>
            <div class="summary"><strong>Notes:</strong> This report is generated automatically by the Inventory Management System.
            Net Balance = Purchase Value - Vendor Payments.</div>
            <div class="footer">Printed on: """ + datetime.now().strftime("%d-%m-%Y %H:%M:%S") + """</div>
    </body></html>
    """

    result = io.BytesIO()
    pdf = pisa.pisaDocument(io.BytesIO(html_content.encode("utf-8")), result)
    if not pdf.err:
        return Response(
            content=result.getvalue(),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=stock_report_{from_date}_to_{to_date}.pdf"},
        )
    return Response(content="PDF Generation Error", status_code=500)
