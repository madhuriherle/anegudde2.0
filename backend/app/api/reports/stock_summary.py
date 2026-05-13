from datetime import date, datetime
from decimal import Decimal
import io

from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import Response
from sqlalchemy import func, case
from sqlalchemy.orm import Session
from xhtml2pdf import pisa

from app.api.deps import get_current_user, get_db
from app.db.models import StockLedger, User, Item, Unit, ConsumptionEntry, ConsumptionItem, WastageItem, MenuItem, TokenGeneration, TokenDetail, WastageEntry
from app.schemas.report import (
    StockReportRow,
    DetailedStockSummaryResponse,
    DetailedStockSummaryRow,
    StockSummaryFooter,
    CanteenSummaryResponse,
    CanteenSummaryFooter,
    CanteenRawReturnRow,
    CanteenWastageRow,
)
from .common import period_expr

router = APIRouter()


@router.get("/get_stock_summary", response_model=list[StockReportRow])
def stock_summary_report(
    from_date: date = Query(...), 
    to_date: date = Query(...), 
    group_by: str = Query("day"), 
    db: Session = Depends(get_db), 
    _: User = Depends(get_current_user)
):
    period = period_expr(group_by, StockLedger.txn_date)
    rows = (
        db.query(
            period.label("period"),
            func.coalesce(func.sum(StockLedger.qty_in), 0).label("qty_in"),
            func.coalesce(func.sum(StockLedger.qty_out), 0).label("qty_out"),
            func.coalesce(func.sum(StockLedger.value_in), 0).label("value_in"),
            func.coalesce(func.sum(StockLedger.value_out), 0).label("value_out"),
        )
        .filter(
            StockLedger.txn_date >= from_date, 
            StockLedger.txn_date <= to_date
        )
        .group_by(period)
        .order_by(period)
        .all()
    )
    return [StockReportRow(period=r.period, qty_in=r.qty_in, qty_out=r.qty_out, value_in=r.value_in, value_out=r.value_out) for r in rows]


@router.get("/get_detailed_stock_summary", response_model=DetailedStockSummaryResponse)
def detailed_stock_summary_report(
    from_date: date = Query(...),
    to_date: date = Query(...),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user)
):
    try:
        # 1. Fetch all items with their units
        items = db.query(Item).join(Unit).filter(Item.status == 1).all()
        
        # 2. Calculate Opening Balances for each item as of from_date
        ob_stats = (
            db.query(
                StockLedger.item_id,
                func.coalesce(func.sum(StockLedger.qty_in - StockLedger.qty_out), 0).label("net_before")
            )
            .filter(StockLedger.txn_date < from_date, StockLedger.status == 1)
            .group_by(StockLedger.item_id)
            .all()
        )
        ob_map = {r.item_id: Decimal(str(r.net_before)) for r in ob_stats}

        # 3. Calculate Period stats for each item
        period_stats = (
            db.query(
                StockLedger.item_id,
                func.coalesce(func.sum(case((StockLedger.txn_type == 1, StockLedger.qty_in), else_=0)), 0).label("purchase_qty"),
                func.coalesce(func.sum(case((StockLedger.txn_type == 2, StockLedger.qty_out), else_=0)), 0).label("issue_qty"),
                func.coalesce(func.sum(case((StockLedger.txn_type == 2, StockLedger.value_out), else_=0)), 0).label("issue_value"),
                func.coalesce(func.sum(case((StockLedger.ref_table.like("%RETURN%"), StockLedger.qty_out), else_=0)), 0).label("purchase_return_qty"),
                func.coalesce(
                    func.sum(
                        case(
                            (StockLedger.ref_table == "consumption_entries:RAW_RETURN", StockLedger.qty_in),
                            else_=0
                        )
                    ),
                    0
                ).label("stock_adjustment_qty"),
                func.coalesce(func.sum(StockLedger.qty_in), 0).label("total_qty_in"),
                func.coalesce(func.sum(StockLedger.qty_out), 0).label("total_qty_out"),
            )
            .filter(
                StockLedger.txn_date >= from_date,
                StockLedger.txn_date <= to_date,
                StockLedger.status == 1
            )
            .group_by(StockLedger.item_id)
            .all()
        )
        period_map = {r.item_id: r for r in period_stats}

        rows = []
        for item in items:
            p = period_map.get(item.id)
            
            # item.opening_stock is String, need to convert
            try:
                base_opening = Decimal(item.opening_stock or "0")
            except:
                base_opening = Decimal("0")
                
            ob = base_opening + ob_map.get(item.id, Decimal("0"))
            
            p_qty = Decimal(str(p.purchase_qty)) if p else Decimal("0")
            i_qty = Decimal(str(p.issue_qty)) if p else Decimal("0")
            i_val = Decimal(str(p.issue_value)) if p else Decimal("0")
            pr_qty = Decimal(str(p.purchase_return_qty)) if p else Decimal("0")
            sa_qty = Decimal(str(p.stock_adjustment_qty)) if p else Decimal("0")
            
            total_in = Decimal(str(p.total_qty_in)) if p else Decimal("0")
            total_out = Decimal(str(p.total_qty_out)) if p else Decimal("0")
            closing = ob + total_in - total_out
            
            rate = item.default_price or Decimal("0")
            closing_val = closing * rate

            rows.append(DetailedStockSummaryRow(
                item_id=item.id,
                item_name=item.item_name,
                category_name=item.category.category_name if item.category else "Uncategorized",
                unit=item.unit.unit_code,
                rate=rate,
                opening_balance=ob,
                purchase_qty=p_qty,
                issue_qty=i_qty,
                issue_value=i_val,
                purchase_return_qty=pr_qty,
                stock_adjustment_qty=sa_qty,
                closing_stock=closing,
                closing_value=closing_val
            ))

        # 4. Fetch Footer Details (Consumptions/Manpower)
        footer_data = (
            db.query(
                func.coalesce(func.sum(ConsumptionEntry.people_served), 0).label("devotees"),
                func.coalesce(func.sum(ConsumptionEntry.times_cooked), 0).label("times_cooked"),
                func.coalesce(func.sum(ConsumptionEntry.regular_cooking_persons + ConsumptionEntry.additional_cooking_persons), 0).label("cooking"),
                func.coalesce(func.sum(ConsumptionEntry.regular_serving_persons + ConsumptionEntry.additional_serving_persons), 0).label("serving"),
                func.coalesce(func.sum(ConsumptionEntry.regular_cleaning_persons + ConsumptionEntry.additional_cleaning_persons), 0).label("cleaning"),
            )
            .filter(
                ConsumptionEntry.usage_date >= from_date,
                ConsumptionEntry.usage_date <= to_date
            )
            .first()
        )

        # Correct calculation for Rice Remained (sum of CLOSING stocks of all items with 'Rice' in name)
        # We've already calculated closing for each item in 'rows'
        rice_remained_qty = sum((row.closing_stock for row in rows if "Rice" in row.item_name), Decimal("0"))

        footer = None
        if footer_data:
            footer = StockSummaryFooter(
                mahaprasada_devotees=int(footer_data.devotees or 0),
                times_cooked=int(footer_data.times_cooked or 0),
                cooking_persons=int(footer_data.cooking or 0),
                serving_persons=int(footer_data.serving or 0),
                cleaning_persons=int(footer_data.cleaning or 0),
                rice_remained=rice_remained_qty,
            )

        return DetailedStockSummaryResponse(
            from_date=from_date,
            to_date=to_date,
            rows=rows,
            footer=footer
        )
    except Exception as e:
        import traceback
        import logging
        logging.error(f"Error in detailed_stock_summary_report: {e}")
        logging.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/get_canteen_summary", response_model=CanteenSummaryResponse)
def canteen_summary_report(
    date_value: date = Query(..., alias="date"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    try:
        from_date = date_value
        to_date = date_value

        items = db.query(Item).join(Unit).filter(Item.status == 1).all()

        ob_stats = (
            db.query(
                StockLedger.item_id,
                func.coalesce(func.sum(StockLedger.qty_in - StockLedger.qty_out), 0).label("net_before")
            )
            .filter(StockLedger.txn_date < from_date, StockLedger.status == 1)
            .group_by(StockLedger.item_id)
            .all()
        )
        ob_map = {r.item_id: Decimal(str(r.net_before)) for r in ob_stats}

        period_stats = (
            db.query(
                StockLedger.item_id,
                func.coalesce(func.sum(case((StockLedger.txn_type == 1, StockLedger.qty_in), else_=0)), 0).label("purchase_qty"),
                func.coalesce(func.sum(case((StockLedger.txn_type == 2, StockLedger.qty_out), else_=0)), 0).label("issue_qty"),
                func.coalesce(func.sum(case((StockLedger.txn_type == 2, StockLedger.value_out), else_=0)), 0).label("issue_value"),
                func.coalesce(func.sum(case((StockLedger.ref_table.like("%RETURN%"), StockLedger.qty_out), else_=0)), 0).label("purchase_return_qty"),
                func.coalesce(
                    func.sum(case((StockLedger.ref_table == "consumption_entries:RAW_RETURN", StockLedger.qty_in), else_=0)),
                    0
                ).label("stock_adjustment_qty"),
                func.coalesce(func.sum(StockLedger.qty_in), 0).label("total_qty_in"),
                func.coalesce(func.sum(StockLedger.qty_out), 0).label("total_qty_out"),
            )
            .filter(
                StockLedger.txn_date >= from_date,
                StockLedger.txn_date <= to_date,
                StockLedger.status == 1
            )
            .group_by(StockLedger.item_id)
            .all()
        )
        period_map = {r.item_id: r for r in period_stats}

        rows = []
        for item in items:
            p = period_map.get(item.id)
            try:
                base_opening = Decimal(item.opening_stock or "0")
            except Exception:
                base_opening = Decimal("0")

            ob = base_opening + ob_map.get(item.id, Decimal("0"))
            p_qty = Decimal(str(p.purchase_qty)) if p else Decimal("0")
            i_qty = Decimal(str(p.issue_qty)) if p else Decimal("0")
            i_val = Decimal(str(p.issue_value)) if p else Decimal("0")
            pr_qty = Decimal(str(p.purchase_return_qty)) if p else Decimal("0")
            sa_qty = Decimal(str(p.stock_adjustment_qty)) if p else Decimal("0")
            total_in = Decimal(str(p.total_qty_in)) if p else Decimal("0")
            total_out = Decimal(str(p.total_qty_out)) if p else Decimal("0")
            closing = ob + total_in - total_out
            rate = item.default_price or Decimal("0")
            closing_val = closing * rate

            rows.append(DetailedStockSummaryRow(
                item_id=item.id,
                item_name=item.item_name,
                category_name=item.category.category_name if item.category else "Uncategorized",
                unit=item.unit.unit_code,
                rate=rate,
                opening_balance=ob,
                purchase_qty=p_qty,
                issue_qty=i_qty,
                issue_value=i_val,
                purchase_return_qty=pr_qty,
                stock_adjustment_qty=sa_qty,
                closing_stock=closing,
                closing_value=closing_val
            ))

        manpower = (
            db.query(
                func.coalesce(func.sum(ConsumptionEntry.regular_cooking_persons), 0).label("regular_cooking"),
                func.coalesce(func.sum(ConsumptionEntry.additional_cooking_persons), 0).label("additional_cooking"),
                func.coalesce(func.sum(ConsumptionEntry.total_cooking_persons), 0).label("total_cooking"),
                func.coalesce(func.sum(ConsumptionEntry.regular_cleaning_persons), 0).label("regular_cleaning"),
                func.coalesce(func.sum(ConsumptionEntry.additional_cleaning_persons), 0).label("additional_cleaning"),
                func.coalesce(func.sum(ConsumptionEntry.total_cleaning_persons), 0).label("total_cleaning"),
                func.coalesce(func.sum(ConsumptionEntry.regular_serving_persons), 0).label("regular_serving"),
                func.coalesce(func.sum(ConsumptionEntry.additional_serving_persons), 0).label("additional_serving"),
                func.coalesce(func.sum(ConsumptionEntry.total_serving_persons), 0).label("total_serving"),
                func.coalesce(func.sum(ConsumptionEntry.times_cooked), 0).label("times_cooked"),
            )
            .filter(ConsumptionEntry.usage_date == date_value, ConsumptionEntry.status == 1)
            .first()
        )

        token_total = (
            db.query(func.coalesce(func.sum(TokenDetail.token_count), 0))
            .join(TokenGeneration, TokenGeneration.id == TokenDetail.generation_id)
            .filter(TokenGeneration.date == date_value)
            .scalar()
        ) or 0
        if token_total == 0:
            token_total = (
                db.query(func.coalesce(func.sum(TokenGeneration.total_tokens), 0))
                .filter(TokenGeneration.date == date_value)
                .scalar()
            ) or 0

        raw_return_rows = (
            db.query(
                Item.item_name.label("item_name"),
                Unit.unit_code.label("unit"),
                func.coalesce(func.sum(ConsumptionItem.qty_returned), 0).label("qty_returned"),
            )
            .join(Item, Item.id == ConsumptionItem.item_id)
            .join(Unit, Unit.id == Item.unit_id)
            .join(ConsumptionEntry, ConsumptionEntry.id == ConsumptionItem.consumption_entry_id)
            .filter(
                ConsumptionEntry.usage_date == date_value,
                ConsumptionEntry.status == 1,
                ConsumptionItem.qty_returned > 0
            )
            .group_by(Item.item_name, Unit.unit_code)
            .order_by(Item.item_name.asc())
            .all()
        )
        raw_returns = [
            CanteenRawReturnRow(
                item_name=r.item_name,
                unit=r.unit,
                qty_returned=Decimal(str(r.qty_returned or 0)),
            )
            for r in raw_return_rows
        ]

        wastage_rows = (
            db.query(
                func.coalesce(Item.item_name, MenuItem.dish_name).label("item_name"),
                func.coalesce(func.sum(WastageItem.quantity), 0).label("qty"),
                func.coalesce(func.sum(WastageItem.approx_amount), 0).label("approx_amount"),
            )
            .join(WastageEntry, WastageEntry.id == WastageItem.wastage_entry_id)
            .outerjoin(Item, Item.id == WastageItem.item_id)
            .outerjoin(MenuItem, MenuItem.id == WastageItem.menu_item_id)
            .filter(
                WastageEntry.wastage_date == date_value,
                WastageEntry.status == 1
            )
            .group_by(func.coalesce(Item.item_name, MenuItem.dish_name))
            .order_by(func.coalesce(Item.item_name, MenuItem.dish_name).asc())
            .all()
        )
        wastage_items = [
            CanteenWastageRow(
                item_name=r.item_name or "-",
                qty=Decimal(str(r.qty or 0)),
                approx_amount=Decimal(str(r.approx_amount or 0)),
            )
            for r in wastage_rows
        ]
        wastage_total_amount = sum((w.approx_amount for w in wastage_items), Decimal("0"))

        footer = CanteenSummaryFooter(
            mahaprasada_devotees=int(token_total or 0),
            regular_cooking_persons=int(manpower.regular_cooking or 0),
            additional_cooking_persons=int(manpower.additional_cooking or 0),
            total_cooking_persons=int(manpower.total_cooking or 0),
            regular_cleaning_persons=int(manpower.regular_cleaning or 0),
            additional_cleaning_persons=int(manpower.additional_cleaning or 0),
            total_cleaning_persons=int(manpower.total_cleaning or 0),
            regular_serving_persons=int(manpower.regular_serving or 0),
            additional_serving_persons=int(manpower.additional_serving or 0),
            total_serving_persons=int(manpower.total_serving or 0),
            times_cooked=int(manpower.times_cooked or 0),
            raw_returns=raw_returns,
            wastage_items=wastage_items,
            wastage_total_amount=wastage_total_amount,
        )

        return CanteenSummaryResponse(date=date_value, rows=rows, footer=footer)
    except Exception as e:
        import traceback
        import logging
        logging.error(f"Error in canteen_summary_report: {e}")
        logging.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/get_canteen_summary_pdf")
def canteen_summary_pdf(
    date_value: date = Query(..., alias="date"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    summary = canteen_summary_report(date_value=date_value, db=db, _=_)
    rows = summary.rows
    footer = summary.footer

    html = f"""
    <html>
    <head>
      <meta charset="utf-8" />
      <style>
        @page {{ size: A4 portrait; margin: 10mm; }}
        @font-face {{
          font-family: 'PdfKannada';
          src: url('file:///C:/Windows/Fonts/Nirmala.ttf');
        }}
        body {{ font-family: PdfKannada, Helvetica, Arial, sans-serif; font-size: 10px; color: #2b1d17; }}
        h1 {{ text-align:center; margin:0; font-size:16px; }}
        h2 {{ text-align:center; margin:4px 0 10px 0; font-size:13px; }}
        table {{ width:100%; border-collapse: collapse; }}
        th, td {{ border:1px solid #c8b29e; padding:4px; }}
        th {{ background:#f5efe8; font-weight:bold; }}
        .r {{ text-align:right; }}
        .c {{ text-align:center; }}
        .boxrow {{ margin-top:8px; width:100%; }}
        .box {{ border:1px solid #c8b29e; vertical-align:top; width:33.33%; padding:6px; }}
        .lbl {{ font-weight:bold; }}
      </style>
    </head>
    <body>
      <h1>Anegudde Sri Vinayaka Devasthana, Kumbashi (Annadana)</h1>
      <h2>CANTEEN SUMMARY REPORT FOR DATE {date_value.strftime('%d-%m-%Y')}</h2>
      <table>
        <thead>
          <tr>
            <th class="c">SL.NO</th>
            <th>ITEM NAME</th>
            <th class="r">RATE</th>
            <th class="r">OPENING STOCK</th>
            <th class="r">STOCK ADDED</th>
            <th class="r">STOCK USED</th>
            <th class="r">USAGE VALUE</th>
            <th class="r">RETURNED TO VENDOR</th>
            <th class="r">STOCK ADJUST</th>
            <th class="r">CLOSING STOCK</th>
            <th class="r">CLOSING VALUE</th>
          </tr>
        </thead>
        <tbody>
    """

    t_open = t_add = t_used = t_uval = t_ret = t_adj = t_close = t_cval = Decimal("0")
    for idx, r in enumerate(rows, start=1):
        t_open += Decimal(r.opening_balance)
        t_add += Decimal(r.purchase_qty)
        t_used += Decimal(r.issue_qty)
        t_uval += Decimal(r.issue_value)
        t_ret += Decimal(r.purchase_return_qty)
        t_adj += Decimal(r.stock_adjustment_qty)
        t_close += Decimal(r.closing_stock)
        t_cval += Decimal(r.closing_value)
        html += f"""
          <tr>
            <td class="c">{idx}</td>
            <td>{r.item_name}</td>
            <td class="r">Rs. {Decimal(r.rate):,.2f}</td>
            <td class="r">{Decimal(r.opening_balance):.3f} {r.unit}</td>
            <td class="r">{Decimal(r.purchase_qty):.3f} {r.unit}</td>
            <td class="r">{Decimal(r.issue_qty):.3f} {r.unit}</td>
            <td class="r">Rs. {Decimal(r.issue_value):,.2f}</td>
            <td class="r">{Decimal(r.purchase_return_qty):.3f} {r.unit}</td>
            <td class="r">{Decimal(r.stock_adjustment_qty):.3f} {r.unit}</td>
            <td class="r"><b>{Decimal(r.closing_stock):.3f} {r.unit}</b></td>
            <td class="r">Rs. {Decimal(r.closing_value):,.2f}</td>
          </tr>
        """

    html += f"""
          <tr>
            <td colspan="3"><b>GRAND TOTAL...</b></td>
            <td class="r"><b>{t_open:.3f}</b></td>
            <td class="r"><b>{t_add:.3f}</b></td>
            <td class="r"><b>{t_used:.3f}</b></td>
            <td class="r"><b>Rs. {t_uval:,.2f}</b></td>
            <td class="r"><b>{t_ret:.3f}</b></td>
            <td class="r"><b>{t_adj:.3f}</b></td>
            <td class="r"><b>{t_close:.3f}</b></td>
            <td class="r"><b>Rs. {t_cval:,.2f}</b></td>
          </tr>
        </tbody>
      </table>

      <table class="boxrow">
        <tr>
          <td class="box">
    """

    if footer.mahaprasada_devotees > 0:
        html += f"""<div><span class="lbl">No. of Mahaprasada Devotees</span> : {footer.mahaprasada_devotees:02d}</div>"""
    if footer.times_cooked > 0:
        html += f"""<div><span class="lbl">No. of times cooked</span> : {footer.times_cooked:02d}</div>"""

    html += """
    """

    for rr in footer.raw_returns:
        if Decimal(rr.qty_returned) > 0:
            html += f"""<div><span class="lbl">{rr.item_name} Remained</span> : {Decimal(rr.qty_returned):.3f} {rr.unit}</div>"""

    html += f"""
          </td>
          <td class="box">
          </td>
          <td class="box">
    """
    person_lines = [
        ("Regular Cooking Persons", footer.regular_cooking_persons),
        ("Additional Cooking Persons", footer.additional_cooking_persons),
        ("Total Cooking Persons", footer.total_cooking_persons),
        ("Regular Cleaning Persons", footer.regular_cleaning_persons),
        ("Additional Cleaning Persons", footer.additional_cleaning_persons),
        ("Total Cleaning Persons", footer.total_cleaning_persons),
        ("Regular Serving Persons", footer.regular_serving_persons),
        ("Additional Serving Persons", footer.additional_serving_persons),
        ("Total Serving Persons", footer.total_serving_persons),
    ]
    for label, value in person_lines:
        if value > 0:
            html += f"""<div><span class="lbl">{label}</span> : {value:02d}</div>"""

    html += """
          </td>
          <td class="box">
    """
    for w in footer.wastage_items:
        if Decimal(w.qty) > 0 or Decimal(w.approx_amount) > 0:
            html += f"""<div><span class="lbl">{w.item_name} Remained</span> {Decimal(w.qty):.3f} Rs. {Decimal(w.approx_amount):,.2f}</div>"""
    if Decimal(footer.wastage_total_amount) > 0:
        html += f"""<div style="text-align:right"><b>Total: Rs. {Decimal(footer.wastage_total_amount):,.2f}</b></div>"""

    html += f"""
          </td>
        </tr>
      </table>
      <div style="margin-top:10px; text-align:center; font-size:9px;">Generated on {datetime.now().strftime('%d-%m-%Y %I:%M %p')}</div>
    </body>
    </html>
    """

    # Use xhtml2pdf here to avoid native GTK/Pango dependency issues on Windows.
    out = io.BytesIO()
    pdf = pisa.pisaDocument(io.BytesIO(html.encode("utf-8")), out)
    if pdf.err:
        return Response(content="PDF Generation Error", status_code=500)
    return Response(
        content=out.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=canteen_summary_{date_value}.pdf"},
    )
