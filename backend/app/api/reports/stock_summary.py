from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, case
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.db.models import StockLedger, User, Item, Unit, ConsumptionEntry
from app.schemas.report import StockReportRow, DetailedStockSummaryResponse, DetailedStockSummaryRow, StockSummaryFooter
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
    # 1. Fetch all items with their units
    items = db.query(Item).join(Unit).filter(Item.status == 1).all()
    
    # 2. Calculate Opening Balances for each item as of from_date
    # OB = item.opening_stock + sum(qty_in - qty_out) for all ledger entries BEFORE from_date
    ob_stats = (
        db.query(
            StockLedger.item_id,
            func.coalesce(func.sum(StockLedger.qty_in - StockLedger.qty_out), 0).label("net_before")
        )
        .filter(StockLedger.txn_date < from_date)
        .group_by(StockLedger.item_id)
        .all()
    )
    ob_map = {r.item_id: r.net_before for r in ob_stats}

    # 3. Calculate Period stats for each item
    period_stats = (
        db.query(
            StockLedger.item_id,
            func.coalesce(func.sum(case((StockLedger.txn_type == 1, StockLedger.qty_in), else_=0)), 0).label("purchase_qty"),
            func.coalesce(func.sum(case((StockLedger.txn_type == 2, StockLedger.qty_out), else_=0)), 0).label("issue_qty"),
            func.coalesce(func.sum(case((StockLedger.txn_type == 2, StockLedger.value_out), else_=0)), 0).label("issue_value"),
            func.coalesce(func.sum(case((StockLedger.ref_table.like("%RETURN%"), StockLedger.qty_out), else_=0)), 0).label("purchase_return_qty"),
            func.coalesce(func.sum(case((StockLedger.txn_type == 4, StockLedger.qty_in - StockLedger.qty_out), else_=0)), 0).label("stock_adjustment_qty"),
            func.coalesce(func.sum(StockLedger.qty_in), 0).label("total_qty_in"),
            func.coalesce(func.sum(StockLedger.qty_out), 0).label("total_qty_out"),
        )
        .filter(
            StockLedger.txn_date >= from_date,
            StockLedger.txn_date <= to_date
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
        
        p_qty = p.purchase_qty if p else Decimal("0")
        i_qty = p.issue_qty if p else Decimal("0")
        i_val = p.issue_value if p else Decimal("0")
        pr_qty = p.purchase_return_qty if p else Decimal("0")
        sa_qty = p.stock_adjustment_qty if p else Decimal("0")
        
        total_in = p.total_qty_in if p else Decimal("0")
        total_out = p.total_qty_out if p else Decimal("0")
        closing = ob + total_in - total_out
        
        rate = item.default_price or Decimal("0")
        closing_val = closing * rate

        rows.append(DetailedStockSummaryRow(
            item_id=item.id,
            item_name=item.item_name,
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
            func.coalesce(func.sum(ConsumptionEntry.anna_remained), 0).label("anna"),
            func.coalesce(func.sum(ConsumptionEntry.saru_remained), 0).label("saru"),
            func.coalesce(func.sum(ConsumptionEntry.huli_remained), 0).label("huli"),
            func.coalesce(func.sum(ConsumptionEntry.payas_remained), 0).label("payas"),
        )
        .filter(
            ConsumptionEntry.usage_date >= from_date,
            ConsumptionEntry.usage_date <= to_date
        )
        .first()
    )

    # Specific calculation for Rice Remained (sum of all items with 'Rice' in name)
    rice_remained_qty = (
        db.query(func.coalesce(func.sum(StockLedger.qty_in - StockLedger.qty_out), 0))
        .join(Item)
        .filter(
            Item.item_name.ilike("%Rice%"),
            StockLedger.txn_date >= from_date,
            StockLedger.txn_date <= to_date
        )
        .scalar()
    ) or Decimal("0")

    footer = None
    if footer_data:
        footer = StockSummaryFooter(
            mahaprasada_devotees=footer_data.devotees,
            times_cooked=footer_data.times_cooked,
            cooking_persons=footer_data.cooking,
            serving_persons=footer_data.serving,
            cleaning_persons=footer_data.cleaning,
            rice_remained=rice_remained_qty,
            anna_remained=footer_data.anna,
            saru_remained=footer_data.saru,
            huli_remained=footer_data.huli,
            payasam_remained=footer_data.payas
        )

    return DetailedStockSummaryResponse(
        from_date=from_date,
        to_date=to_date,
        rows=rows,
        footer=footer
    )
