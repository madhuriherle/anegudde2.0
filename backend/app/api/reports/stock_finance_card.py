from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.db.models import StockLedger, User, VendorPayment
from app.schemas.report import StockFinanceCardRow
from .common import period_expr

router = APIRouter()


@router.get("/stock-finance-card", response_model=list[StockFinanceCardRow])
def stock_finance_card(
    from_date: date = Query(...),
    to_date: date = Query(...),
    group_by: str = Query("day"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if group_by not in {"day", "month"}:
        raise HTTPException(status_code=400, detail="group_by must be day or month")

    period_stock = period_expr(group_by, StockLedger.txn_date)
    stock_rows = (
        db.query(
            period_stock.label("period"),
            func.coalesce(func.sum(StockLedger.qty_in), 0).label("total_qty_in"),
            func.coalesce(func.sum(StockLedger.qty_out), 0).label("total_qty_out"),
            func.coalesce(func.sum(case((StockLedger.txn_type == 1, StockLedger.qty_in), else_=0)), 0).label("purchased_qty"),
            func.coalesce(func.sum(case((StockLedger.txn_type == 2, StockLedger.qty_out), else_=0)), 0).label("consumed_qty"),
            func.coalesce(func.sum(case((StockLedger.txn_type == 3, StockLedger.qty_out), else_=0)), 0).label("wastage_qty"),
            func.coalesce(func.sum(case((StockLedger.txn_type == 1, StockLedger.value_in), else_=0)), 0).label("purchase_value"),
            func.coalesce(func.sum(case((StockLedger.txn_type == 2, StockLedger.value_out), else_=0)), 0).label("consumption_value"),
            func.coalesce(func.sum(case((StockLedger.txn_type == 3, StockLedger.value_out), else_=0)), 0).label("wastage_value"),
        )
        .filter(StockLedger.txn_date >= from_date, StockLedger.txn_date <= to_date)
        .group_by(period_stock)
        .order_by(period_stock)
        .all()
    )

    period_pay = period_expr(group_by, VendorPayment.payment_date)
    pay_rows = (
        db.query(period_pay.label("period"), func.coalesce(func.sum(VendorPayment.amount), 0).label("payment_value"))
        .filter(VendorPayment.payment_date >= from_date, VendorPayment.payment_date <= to_date)
        .group_by(period_pay)
        .all()
    )
    pay_map = {r.period: r.payment_value for r in pay_rows}

    running_stock = Decimal("0")
    out: list[StockFinanceCardRow] = []
    for r in stock_rows:
        opening = running_stock
        closing = opening + (r.total_qty_in or Decimal("0")) - (r.total_qty_out or Decimal("0"))
        running_stock = closing

        payment_value = pay_map.get(r.period, Decimal("0"))
        net_fin = (r.purchase_value or Decimal("0")) - (payment_value or Decimal("0"))

        out.append(
            StockFinanceCardRow(
                period=r.period,
                opening_stock=opening,
                purchased_qty=r.purchased_qty or Decimal("0"),
                consumed_qty=r.consumed_qty or Decimal("0"),
                wastage_qty=r.wastage_qty or Decimal("0"),
                closing_stock=closing,
                purchase_value=r.purchase_value or Decimal("0"),
                consumption_value=r.consumption_value or Decimal("0"),
                wastage_value=r.wastage_value or Decimal("0"),
                vendor_payment_value=payment_value or Decimal("0"),
                net_financial_balance=net_fin,
            )
        )
    return out
