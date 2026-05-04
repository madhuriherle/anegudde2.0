from datetime import date
from decimal import Decimal
from pydantic import BaseModel


class ReportRow(BaseModel):
    period: str
    total_amount: Decimal
    total_count: int


class StockReportRow(BaseModel):
    period: str
    qty_in: Decimal
    qty_out: Decimal
    value_in: Decimal
    value_out: Decimal


class StockFinanceCardRow(BaseModel):
    period: str
    opening_stock: Decimal
    purchased_qty: Decimal
    consumed_qty: Decimal
    wastage_qty: Decimal
    closing_stock: Decimal
    purchase_value: Decimal
    consumption_value: Decimal
    wastage_value: Decimal
    vendor_payment_value: Decimal
    net_financial_balance: Decimal


class ReportQuery(BaseModel):
    from_date: date
    to_date: date
    group_by: str
