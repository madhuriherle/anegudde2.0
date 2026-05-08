from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel


class DashboardOverview(BaseModel):
    total_vendors: int
    total_items: int
    total_units: int
    total_categories: int
    total_users: int
    low_stock_items: int
    total_stock_value: Decimal
    total_outstanding_balance: Decimal


class DashboardToday(BaseModel):
    purchase_amount: Decimal
    consumption_entries: int
    consumption_value: Decimal
    wastage_entries: int
    wastage_value: Decimal
    vendor_payment_amount: Decimal
    tokens_issued: int
    purchase_details: list["DailyItemDetail"]
    consumption_details: list["DailyItemDetail"]
    wastage_details: list["DailyWastageDetail"]


class DailyItemDetail(BaseModel):
    item_name: str
    unit_name: str
    quantity: Decimal
    amount: Decimal


class DailyWastageDetail(BaseModel):
    menu_item_name: str
    unit_name: str
    quantity: Decimal


class LowStockRow(BaseModel):
    item_id: int
    item_name: str
    current_stock: Decimal
    min_stock_level: Decimal | None = None

class RecentActivityRow(BaseModel):
    activity_type: str  # 'purchase', 'consumption', 'wastage', 'payment', 'adjustment'
    title: str
    description: str
    amount: Decimal | None = None
    created_at: datetime
