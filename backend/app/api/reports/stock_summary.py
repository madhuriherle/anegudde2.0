from datetime import date, datetime
from decimal import Decimal
from html import escape
import io
import os
from pathlib import Path

from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import Response
from sqlalchemy import func, case
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, PermissionChecker
from app.db.models import StockLedger, User, Item, Unit, ConsumptionEntry, ConsumptionItem, WastageItem, MenuItem, TokenGeneration, TokenDetail, WastageEntry, SystemSettings
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

from app.utils.pdf_gen import html_to_pdf_with_browser
from app.utils.report_pdf import render_report_pdf, money, qty

router = APIRouter()

@router.get("/get_stock_summary", response_model=list[StockReportRow])
def stock_summary_report(
    from_date: date = Query(...), 
    to_date: date = Query(...), 
    group_by: str = Query("day"), 
    db: Session = Depends(get_db), 
    _: User = Depends(PermissionChecker("reports.read"))
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
    _: User = Depends(PermissionChecker("reports.read"))
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
                            (StockLedger.txn_type == 7, StockLedger.qty_in),
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


@router.get("/get_detailed_stock_summary_pdf")
def detailed_stock_summary_report_pdf(
    from_date: date = Query(...),
    to_date: date = Query(...),
    db: Session = Depends(get_db),
    _: User = Depends(PermissionChecker("reports.read"))
):
    summary = detailed_stock_summary_report(from_date=from_date, to_date=to_date, db=db, _=_)

    grouped_rows = {}
    for row in summary.rows:
        grouped_rows.setdefault(row.category_name or "Uncategorized", []).append(row)

    table_rows = []
    totals = {
        "opening": Decimal("0"),
        "added": Decimal("0"),
        "used": Decimal("0"),
        "usage_value": Decimal("0"),
        "returned": Decimal("0"),
        "adjust": Decimal("0"),
        "closing": Decimal("0"),
        "closing_value": Decimal("0"),
    }

    for category in sorted(grouped_rows.keys()):
        category_rows = grouped_rows[category]
        table_rows.append(f"""
          <tr class="category-row">
            <td colspan="10">{escape(category)}</td>
          </tr>
        """)

        category_totals = {key: Decimal("0") for key in totals}
        for row in category_rows:
            opening = Decimal(str(row.opening_balance))
            added = Decimal(str(row.purchase_qty))
            used = Decimal(str(row.issue_qty))
            usage_value = Decimal(str(row.issue_value))
            returned = Decimal(str(row.purchase_return_qty))
            adjust = Decimal(str(row.stock_adjustment_qty))
            closing = Decimal(str(row.closing_stock))
            closing_value = Decimal(str(row.closing_value))

            category_totals["opening"] += opening
            category_totals["added"] += added
            category_totals["used"] += used
            category_totals["usage_value"] += usage_value
            category_totals["returned"] += returned
            category_totals["adjust"] += adjust
            category_totals["closing"] += closing
            category_totals["closing_value"] += closing_value

            table_rows.append(f"""
              <tr>
                <td>{escape(str(row.item_name or ""))}</td>
                <td class="r">{money(row.rate)}</td>
                <td class="r">{qty(opening)}</td>
                <td class="r">{qty(added)}</td>
                <td class="r">{qty(used)}</td>
                <td class="r">{money(usage_value)}</td>
                <td class="r">{qty(returned)}</td>
                <td class="r">{qty(adjust)}</td>
                <td class="r">{qty(closing)} {escape(str(row.unit or ""))}</td>
                <td class="r">{money(closing_value)}</td>
              </tr>
            """)

        for key, value in category_totals.items():
            totals[key] += value

        table_rows.append(f"""
          <tr class="total-row">
            <td colspan="2" class="c">TOTAL</td>
            <td class="r">{qty(category_totals["opening"])}</td>
            <td class="r">{qty(category_totals["added"])}</td>
            <td class="r">{qty(category_totals["used"])}</td>
            <td class="r">{money(category_totals["usage_value"])}</td>
            <td class="r">{qty(category_totals["returned"])}</td>
            <td class="r">{qty(category_totals["adjust"])}</td>
            <td class="r">{qty(category_totals["closing"])}</td>
            <td class="r">{money(category_totals["closing_value"])}</td>
          </tr>
        """)

    body_html = f"""
      <style>
        .stock-summary-table {{ width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 12px; }}
        .stock-summary-table th {{ background: #FAF7F2; color: #5A2D1F; border: 1px solid #E7D8CC; padding: 6px 2px; font-size: 8px; text-transform: uppercase; line-height: 1.2; }}
        .stock-summary-table td {{ border: 1px solid #E7D8CC; padding: 5px 3px; font-size: 9px; vertical-align: middle; word-wrap: break-word; }}
        .stock-summary-table .category-row td {{ background: #FAF7F2; color: #5A2D1F; font-size: 10px; font-weight: 800; border-bottom: 2px solid #E7D8CC; }}
        .stock-summary-table .total-row td {{ background: #FAF7F2; color: #5A2D1F; font-size: 9px; font-weight: 800; }}
        .stock-summary-table .grand-row td {{ background: #FAF7F2; color: #5A2D1F; font-size: 10px; font-weight: 900; border-top: 2px solid #5A2D1F; }}
      </style>
      <table class="stock-summary-table">
        <thead>
          <tr>
            <th style="width:24%;"></th>
            <th style="width:7%;" class="r">RATE</th>
            <th style="width:8%;" class="r">OPENING STOCK</th>
            <th style="width:8%;" class="r">STOCK ADDED</th>
            <th style="width:8%;" class="r">STOCK USED</th>
            <th style="width:9%;" class="r">USAGE VALUE</th>
            <th style="width:10%;" class="r">RETURNED TO VENDOR</th>
            <th style="width:8%;" class="r">STOCK ADJUST</th>
            <th style="width:9%;" class="r">CLOSING STOCK</th>
            <th style="width:9%;" class="r">CLOSING VALUE</th>
          </tr>
        </thead>
        <tbody>
          {''.join(table_rows) if table_rows else '<tr><td colspan="10" class="c">No data found</td></tr>'}
          <tr class="grand-row">
            <td colspan="2" class="c">GRAND TOTAL</td>
            <td class="r">{qty(totals["opening"])}</td>
            <td class="r">{qty(totals["added"])}</td>
            <td class="r">{qty(totals["used"])}</td>
            <td class="r">{money(totals["usage_value"])}</td>
            <td class="r">{qty(totals["returned"])}</td>
            <td class="r">{qty(totals["adjust"])}</td>
            <td class="r">{qty(totals["closing"])}</td>
            <td class="r">{money(totals["closing_value"])}</td>
          </tr>
        </tbody>
      </table>
    """
    pdf_bytes = render_report_pdf(
        db=db,
        title="Stock Summary Report",
        subtitle=f"From {from_date.strftime('%d-%m-%Y')} To {to_date.strftime('%d-%m-%Y')}",
        body_html=body_html,
        orientation="landscape",
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=stock_summary_report.pdf"},
    )


@router.get("/get_canteen_summary", response_model=CanteenSummaryResponse)
def canteen_summary_report(
    date_value: date = Query(..., alias="date"),
    db: Session = Depends(get_db),
    _: User = Depends(PermissionChecker("reports.read")),
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

        # Fetch all active menu items
        menu_items = db.query(MenuItem).filter(MenuItem.status == 1).order_by(MenuItem.dish_name.asc()).all()

        # Fetch actual wastage for the date
        wastage_data = (
            db.query(
                WastageItem.menu_item_id,
                func.coalesce(func.sum(WastageItem.quantity), 0).label("qty"),
                func.coalesce(func.sum(WastageItem.approx_amount), 0).label("approx_amount"),
            )
            .join(WastageEntry, WastageEntry.id == WastageItem.wastage_entry_id)
            .filter(
                WastageEntry.wastage_date == date_value,
                WastageEntry.status == 1,
                WastageItem.menu_item_id.isnot(None)
            )
            .group_by(WastageItem.menu_item_id)
            .all()
        )
        wastage_map = {w.menu_item_id: w for w in wastage_data}

        wastage_items = []
        for mi in menu_items:
            w = wastage_map.get(mi.id)
            wastage_items.append(CanteenWastageRow(
                item_name=mi.dish_name,
                qty=Decimal(str(w.qty if w else 0)),
                approx_amount=Decimal(str(w.approx_amount if w else 0)),
            ))
            
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
    _: User = Depends(PermissionChecker("reports.read")),
):
    summary = canteen_summary_report(date_value=date_value, db=db, _=_)
    rows = summary.rows
    footer = summary.footer

    # Fetch system settings for the branded header
    settings = db.query(SystemSettings).first()
    
    PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../.."))
    logo_path = ""
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

    contact_parts = []
    if is_visible("show_temple_contact") and temple_contact:
        contact_parts.append(temple_contact)
    if is_visible("show_alternate_contact") and alternate_contact:
        contact_parts.append(alternate_contact)
    contact_text = " / ".join(contact_parts)

    # Group rows by category
    grouped_rows = {}
    for r in rows:
        cat = r.category_name or "Uncategorized"
        if cat not in grouped_rows:
            grouped_rows[cat] = []
        grouped_rows[cat].append(r)

    # Sort categories alphabetically
    sorted_cats = sorted(grouped_rows.keys())

    table_body_html = ""
    t_open = t_add = t_used = t_uval = t_ret = t_adj = t_close = t_cval = Decimal("0")
    
    for cat in sorted_cats:
        cat_rows = grouped_rows[cat]
        # Category Header Row
        table_body_html += f"""
          <tr style="background-color: #FAF7F2;">
            <td colspan="10" style="font-weight: 800; color: #5A2D1F; font-size: 10px; border-bottom: 2px solid #E7D8CC;">{cat}</td>
          </tr>
        """
        
        c_open = c_add = c_used = c_uval = c_ret = c_adj = c_close = c_cval = Decimal("0")
        
        for r in cat_rows:
            r_open = Decimal(str(r.opening_balance))
            r_add = Decimal(str(r.purchase_qty))
            r_used = Decimal(str(r.issue_qty))
            r_uval = Decimal(str(r.issue_value))
            r_ret = Decimal(str(r.purchase_return_qty))
            r_adj = Decimal(str(r.stock_adjustment_qty))
            r_close = Decimal(str(r.closing_stock))
            r_cval = Decimal(str(r.closing_value))
            
            c_open += r_open
            c_add += r_add
            c_used += r_used
            c_uval += r_uval
            c_ret += r_ret
            c_adj += r_adj
            c_close += r_close
            c_cval += r_cval
            
            table_body_html += f"""
              <tr>
                <td>{r.item_name}</td>
                <td class="r">₹{Decimal(r.rate):,.2f}</td>
                <td class="r">{r_open:.3f}</td>
                <td class="r">{r_add:.3f}</td>
                <td class="r">{r_used:.3f}</td>
                <td class="r">₹{r_uval:,.2f}</td>
                <td class="r">{r_ret:.3f}</td>
                <td class="r">{r_adj:.3f}</td>
                <td class="r">{r_close:.3f} {r.unit}</td>
                <td class="r">₹{r_cval:,.2f}</td>
              </tr>
            """

        # Category Total Row (Renamed to TOTAL)
        table_body_html += f"""
          <tr style="background-color: #FAF7F2; font-size: 9px;">
            <td colspan="2" class="c" style="font-weight: 800; color: #5A2D1F;">TOTAL</td>
            <td class="r">{c_open:.3f}</td>
            <td class="r">{c_add:.3f}</td>
            <td class="r">{c_used:.3f}</td>
            <td class="r">₹{c_uval:,.2f}</td>
            <td class="r">{c_ret:.3f}</td>
            <td class="r">{c_adj:.3f}</td>
            <td class="r">{c_close:.3f}</td>
            <td class="r">₹{c_cval:,.2f}</td>
          </tr>
        """
        
        t_open += c_open
        t_add += c_add
        t_used += c_used
        t_uval += c_uval
        t_ret += c_ret
        t_adj += c_adj
        t_close += c_close
        t_cval += c_cval

    html_content = f"""
    <html>
    <head>
      <meta charset="utf-8" />
      <style>
        @page {{ size: A4 landscape; margin: 10mm; }}
        body {{ 
          font-family: "Nirmala UI", "Nirmala", "Segoe UI", Arial, sans-serif; 
          font-size: 10px; 
          color: #2b1d17; 
          line-height: 1.4;
        }}
        
        .header-container {{ text-align: center; margin-bottom: 20px; border-bottom: 2px solid #5A2D1F; padding-bottom: 15px; }}
        .logo {{ height: 70px; margin-bottom: 8px; }}
        .temple-name-kn {{ font-size: 24px; font-weight: 800; color: #5A2D1F; margin: 0; }}
        .temple-name-en {{ font-size: 16px; font-weight: 700; color: #2B2B2B; margin: 4px 0; text-transform: uppercase; }}
        .temple-info {{ font-size: 11px; color: #4B4B4B; margin: 2px 0; font-weight: 500; }}
        
        .report-title {{ text-align: center; font-size: 14px; font-weight: 800; margin: 15px 0; text-decoration: underline; text-transform: uppercase; color: #2B2B2B; }}
        
        table {{ width:100%; border-collapse: collapse; margin-bottom: 20px; table-layout: fixed; }}
        th {{ background:#FAF7F2; font-weight:bold; color: #5A2D1F; text-transform: uppercase; font-size: 8px; border: 1px solid #E7D8CC; padding: 6px 2px; line-height: 1.2; }}
        td {{ border:1px solid #E7D8CC; padding:5px 3px; vertical-align: middle; word-wrap: break-word; font-size: 9px; }}
        
        .r {{ text-align:right; }}
        .c {{ text-align:center; }}
        
        .footer-sections {{ display: flex; gap: 10px; margin-top: 10px; }}
        .box {{ border: 1px solid #E7D8CC; padding: 10px; border-radius: 8px; flex: 1; background: #FFFDFB; }}
        .box-title {{ font-weight: 800; border-bottom: 2px solid #E7D8CC; margin-bottom: 8px; padding-bottom: 4px; color: #5A2D1F; text-transform: uppercase; font-size: 10px; }}
        .lbl {{ font-weight: 700; color: #2B2B2B; font-size: 9px; }}
        .val {{ font-size: 9px; }}
        
        .footer-item {{ display: flex; justify-content: space-between; margin-bottom: 3px; border-bottom: 1px solid #FAF7F2; padding-bottom: 2px; }}
        .total-line {{ margin-top: 8px; padding-top: 6px; border-top: 1px dashed #E7D8CC; text-align: right; font-weight: 800; color: #5A2D1F; }}
        
        .footer-note {{ margin-top: 30px; text-align: center; font-size: 9px; color: #8B8B8B; border-top: 1px solid #FAF7F2; padding-top: 10px; font-style: italic; }}
      </style>
    </head>
    <body>
      <div class="header-container">
        {f'<img src="{logo_path}" class="logo" />' if logo_path else ''}
        {f'<div class="temple-name-kn">{temple_name_kn}</div>' if is_visible("show_temple_name_kn") and temple_name_kn else ''}
        {f'<div class="temple-name-en">{temple_name}</div>' if is_visible("show_temple_name") else ''}
        {f'<div class="temple-info">{temple_address}</div>' if is_visible("show_temple_address") and temple_address else ''}
        {f'<div class="temple-info">Contact: {contact_text}</div>' if contact_text else ''}
      </div>

      <div class="report-title">CANTEEN SUMMARY REPORT - {date_value.strftime('%d-%m-%Y')}</div>

      <table>
        <thead>
          <tr>
            <th width="24%"></th>
            <th width="7%" class="r">RATE</th>
            <th width="8%" class="r">OPENING STOCK</th>
            <th width="8%" class="r">STOCK ADDED</th>
            <th width="8%" class="r">STOCK USED</th>
            <th width="9%" class="r">USAGE VALUE</th>
            <th width="10%" class="r">RETURNED TO VENDOR</th>
            <th width="8%" class="r">STOCK ADJUST</th>
            <th width="9%" class="r">CLOSING STOCK</th>
            <th width="9%" class="r">CLOSING VALUE</th>
          </tr>
        </thead>
        <tbody>
          {table_body_html}
          <tr style="background-color: #FAF7F2; color: #5A2D1F; font-size: 10px;">
            <td colspan="2" class="c" style="font-weight: 800;">GRAND TOTAL</td>
            <td class="r">{t_open:.3f}</td>
            <td class="r">{t_add:.3f}</td>
            <td class="r">{t_used:.3f}</td>
            <td class="r">₹{t_uval:,.2f}</td>
            <td class="r">{t_ret:.3f}</td>
            <td class="r">{t_adj:.3f}</td>
            <td class="r">{t_close:.3f}</td>
            <td class="r">₹{t_cval:,.2f}</td>
          </tr>
        </tbody>
      </table>

      <div class="footer-sections">
          <div class="box">
            <div class="box-title">Day Snapshot</div>
            <div class="footer-item"><span class="lbl">No. of Mahaprasada Devotees</span><span class="val">{footer.mahaprasada_devotees}</span></div>
            <div class="footer-item"><span class="lbl">Regular Cooking Persons</span><span class="val">{footer.regular_cooking_persons}</span></div>
            <div class="footer-item"><span class="lbl">Additional Cooking Persons</span><span class="val">{footer.additional_cooking_persons}</span></div>
            <div class="footer-item"><span class="lbl">Total Cooking Persons</span><span class="val">{footer.total_cooking_persons}</span></div>
            <div class="footer-item"><span class="lbl">Regular Serving Persons</span><span class="val">{footer.regular_serving_persons}</span></div>
            <div class="footer-item"><span class="lbl">Additional Serving Persons</span><span class="val">{footer.additional_serving_persons}</span></div>
            <div class="footer-item"><span class="lbl">Total Serving Persons</span><span class="val">{footer.total_serving_persons}</span></div>
            <div class="footer-item"><span class="lbl">Regular Cleaning Persons</span><span class="val">{footer.regular_cleaning_persons}</span></div>
            <div class="footer-item"><span class="lbl">Additional Cleaning Persons</span><span class="val">{footer.additional_cleaning_persons}</span></div>
            <div class="footer-item"><span class="lbl">Total Cleaning Persons</span><span class="val">{footer.total_cleaning_persons}</span></div>
            <div class="footer-item"><span class="lbl">No. of Times Cooked</span><span class="val">{footer.times_cooked}</span></div>
          </div>
          
          <div class="box">
            <div class="box-title">Wastage</div>
    """
    for w in footer.wastage_items:
        html_content += f"""
              <div class="footer-item">
                <span class="lbl">{w.item_name}</span>
                <span class="val">{Decimal(w.qty):.3f} (₹{Decimal(w.approx_amount):,.2f})</span>
              </div>
            """
    
    html_content += f"""
            <div class="total-line">Total Wastage: ₹{Decimal(footer.wastage_total_amount):,.2f}</div>
          </div>
          
          <div class="box">
            <div class="box-title">Raw Items Returned</div>
    """
    if not footer.raw_returns or all(Decimal(rr.qty_returned) == 0 for rr in footer.raw_returns):
        html_content += """<div class="val" style="text-align: center; margin-top: 10px;">No raw items returned.</div>"""
    else:
        for rr in footer.raw_returns:
            if Decimal(rr.qty_returned) > 0:
                html_content += f"""
                  <div class="footer-item">
                    <span class="lbl">{rr.item_name}</span>
                    <span class="val">{Decimal(rr.qty_returned):.3f} {rr.unit}</span>
                  </div>
                """

    html_content += f"""
          </div>
      </div>
      
      <div class="footer-note">Generated by Anegudde Inventory Management System on {datetime.now().strftime('%d-%m-%Y %I:%M %p')}</div>
    </body>
    </html>
    """

    # Use browser-based PDF generation for perfect Kannada support
    pdf_bytes = html_to_pdf_with_browser(html_content, PROJECT_ROOT)
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=canteen_summary_{date_value}.pdf"},
    )
