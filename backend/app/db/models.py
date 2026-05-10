from sqlalchemy import Column, Date, DateTime, ForeignKey, ForeignKeyConstraint, Integer, Numeric, SmallInteger, String, Text, text, Boolean
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship, declared_attr
from sqlalchemy.sql import func
from app.db.base import Base

# ==========================================
# 0. CORE SCORING & UTILITY
# ==========================================

class FinancialYear(Base):
    __tablename__ = "financial_years"
    id = Column(Integer, primary_key=True)
    name = Column(String(20), unique=True, nullable=False) # e.g., "2024-25"
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    is_active = Column(Boolean, default=False, nullable=False)
    status = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now())
    created_by = Column(Integer, nullable=True)

# ==========================================
# 1. MASTER TABLES (STANDARD - NOT PARTITIONED)
# ==========================================

class Role(Base):
    __tablename__ = "roles"
    id = Column(Integer, primary_key=True)
    role_name = Column(String(50), unique=True, nullable=False)
    status = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now())
    created_by = Column(Integer, nullable=True)
    updated_by = Column(Integer, nullable=True)

class Privilege(Base):
    __tablename__ = "privileges"
    id = Column(Integer, primary_key=True)
    privilege_name = Column(String(100), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now())
    created_by = Column(Integer, nullable=True)
    updated_by = Column(Integer, nullable=True)

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    username = Column(String(100), unique=True, nullable=False)
    password = Column(String(255), nullable=False)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False)
    full_name = Column(String(150), nullable=False)
    email = Column(String(150), nullable=True)
    phone = Column(String(20), nullable=True)
    status = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now())
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    role = relationship("Role", foreign_keys=[role_id])

class RolePrivilege(Base):
    __tablename__ = "role_privileges"
    id = Column(Integer, primary_key=True)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False)
    privilege_id = Column(Integer, ForeignKey("privileges.id"), nullable=False)
    status = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now())
    created_by = Column(Integer, nullable=True)
    updated_by = Column(Integer, nullable=True)

class Vendor(Base):
    __tablename__ = "vendors"
    id = Column(Integer, primary_key=True)
    vendor_code = Column(String(30), unique=True, nullable=False)
    vendor_name = Column(String(150), nullable=False)
    contact_person = Column(String(150), nullable=True)
    contact_number = Column(String(20), nullable=False)
    alternate_contact_number = Column(String(20), nullable=True)
    email = Column(String(150), nullable=True)
    address_line1 = Column(String(255), nullable=False)
    address_line2 = Column(String(255), nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    postal_code = Column(String(20), nullable=True)
    pan_number = Column(String(20), nullable=True)
    opening_balance = Column(Numeric(15, 3), nullable=False, default=0)
    credit_limit = Column(Numeric(15, 3), nullable=True)
    notes = Column(Text, nullable=True)
    status = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now())
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)

class Unit(Base):
    __tablename__ = "units"
    id = Column(Integer, primary_key=True)
    unit_name = Column(String(50), nullable=False)
    unit_code = Column(String(20), nullable=False)
    status = Column(Integer, nullable=False, server_default=text("1")) # 1: Active, 0: Inactive
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now())
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)

class ItemType(Base):
    __tablename__ = "item_types"
    id = Column(Integer, primary_key=True)
    type_name = Column(String(100), unique=True, nullable=False)
    status = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now())
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)

class MenuItem(Base):
    __tablename__ = "menu_items"
    id = Column(Integer, primary_key=True)
    dish_name = Column(String(150), nullable=False)
    unit_id = Column(Integer, ForeignKey("units.id"), nullable=False)
    status = Column(Integer, nullable=False, server_default=text("1")) # 1: Active, 0: Disabled
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now())
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Relationships
    unit = relationship("Unit", foreign_keys=[unit_id])
    creator = relationship("User", foreign_keys=[created_by])
    updater = relationship("User", foreign_keys=[updated_by])

class ItemCategory(Base):
    __tablename__ = "item_categories"
    id = Column(Integer, primary_key=True)
    type_id = Column(Integer, ForeignKey("item_types.id"), nullable=False)
    category_name = Column(String(100), nullable=False)
    status = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now())
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    item_type = relationship("ItemType", foreign_keys=[type_id])

class Item(Base):
    __tablename__ = "items"
    id = Column(Integer, primary_key=True)
    item_name = Column(String(150), unique=True, nullable=False)
    category_id = Column(Integer, ForeignKey("item_categories.id"), nullable=False)
    unit_id = Column(Integer, ForeignKey("units.id"), nullable=False)
    opening_stock = Column(Numeric(15, 3), nullable=False, default=0)
    current_stock = Column(Numeric(15, 3), nullable=False, default=0)
    default_price = Column(Numeric(15, 3), nullable=True)
    min_stock_level = Column(Numeric(15, 3), nullable=True)
    max_stock_level = Column(Numeric(15, 3), nullable=True)
    status = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now())
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    category = relationship("ItemCategory", foreign_keys=[category_id])
    unit = relationship("Unit", foreign_keys=[unit_id])
    serial_numbers = relationship("ItemSerialNumber", back_populates="item", cascade="all, delete-orphan")

class ItemSerialNumber(Base):
    __tablename__ = "item_serial_numbers"
    id = Column(Integer, primary_key=True)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    serial_number = Column(String(50), unique=True, nullable=False)
    status = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    
    item = relationship("Item", back_populates="serial_numbers")

class ItemPrice(Base):
    __tablename__ = "item_prices"
    id = Column(Integer, primary_key=True)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    price = Column(Numeric(15, 3), nullable=False)
    purchase_entry_id = Column(Integer, ForeignKey("purchase_entries.id"), nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    item = relationship("Item", backref="prices")
    purchase = relationship("PurchaseEntry")

# ==========================================
# 2. TRANSACTION TABLES (PARTITIONED)
# ==========================================

class PurchaseEntry(Base):
    __tablename__ = "purchase_entries"
    id = Column(Integer, primary_key=True)
    purchase_date = Column(Date, nullable=False)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False)
    bill_no = Column(String(50), nullable=True) # Bill/Invoice Number
    total_amount = Column(Numeric(15, 3), nullable=False) # Sum of item line totals
    invoice_amount = Column(Numeric(15, 3), nullable=True) # Manual entry for actual invoice amount
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now())
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    vendor = relationship("Vendor", foreign_keys=[vendor_id])
    user = relationship("User", foreign_keys=[user_id])
    items = relationship("PurchaseItem", back_populates="purchase_entry", cascade="all, delete-orphan")
    bills = relationship("PurchaseBill", back_populates="purchase_entry", cascade="all, delete-orphan")

class PurchaseBill(Base):
    __tablename__ = "purchase_bills"
    id = Column(Integer, primary_key=True)
    purchase_id = Column(Integer, ForeignKey("purchase_entries.id"), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_type = Column(String(100), nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    
    purchase_entry = relationship("PurchaseEntry", back_populates="bills")

class PurchaseItem(Base):
    __tablename__ = "purchase_items"
    id = Column(Integer, primary_key=True)
    purchase_entry_id = Column(Integer, ForeignKey("purchase_entries.id"), nullable=False)
    purchase_date = Column(Date, nullable=False)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    quantity = Column(Numeric(15, 3), nullable=False)
    price = Column(Numeric(15, 3), nullable=False)
    line_total = Column(Numeric(15, 3), nullable=False)
    status = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now())
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    item = relationship("Item", foreign_keys=[item_id])
    purchase_entry = relationship("PurchaseEntry", back_populates="items")

class ConsumptionEntry(Base):
    __tablename__ = "consumption_entries"
    id = Column(Integer, primary_key=True)
    usage_date = Column(Date, nullable=False)
    people_served = Column(Integer, nullable=True)
    remarks = Column(Text, nullable=True)
    regular_cooking_persons = Column(Integer, nullable=False, default=0, server_default=text("0"))
    additional_cooking_persons = Column(Integer, nullable=False, default=0, server_default=text("0"))
    total_cooking_persons = Column(Integer, nullable=False, default=0, server_default=text("0"))
    regular_cleaning_persons = Column(Integer, nullable=False, default=0, server_default=text("0"))
    additional_cleaning_persons = Column(Integer, nullable=False, default=0, server_default=text("0"))
    total_cleaning_persons = Column(Integer, nullable=False, default=0, server_default=text("0"))
    regular_serving_persons = Column(Integer, nullable=False, default=0, server_default=text("0"))
    additional_serving_persons = Column(Integer, nullable=False, default=0, server_default=text("0"))
    total_serving_persons = Column(Integer, nullable=False, default=0, server_default=text("0"))
    times_cooked = Column(Integer, nullable=False, default=0, server_default=text("0"))
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now())
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    user = relationship("User", foreign_keys=[user_id])
    items = relationship("ConsumptionItem", back_populates="consumption_entry", cascade="all, delete-orphan")
    wastage_items = relationship("WastageItem", back_populates="consumption_entry", cascade="all, delete-orphan")
    wastages = relationship("WastageEntry", back_populates="consumption_entry", cascade="all, delete-orphan")

class ConsumptionItem(Base):
    __tablename__ = "consumption_items"
    id = Column(Integer, primary_key=True)
    consumption_entry_id = Column(Integer, ForeignKey("consumption_entries.id"), nullable=False)
    usage_date = Column(Date, nullable=False)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    quantity_used = Column(Numeric(15, 3), nullable=False)
    qty_returned = Column(Numeric(15, 3), nullable=False, default=0, server_default=text("0"))
    net_quantity = Column(Numeric(15, 3), nullable=False, default=0, server_default=text("0"))
    unit_cost_at_time = Column(Numeric(15, 3), nullable=True)
    line_total = Column(Numeric(15, 3), nullable=False)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now())
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    item = relationship("Item", foreign_keys=[item_id])
    consumption_entry = relationship("ConsumptionEntry", back_populates="items")

class WastageEntry(Base):
    __tablename__ = "wastage_entries"
    id = Column(Integer, primary_key=True)
    consumption_entry_id = Column(Integer, ForeignKey("consumption_entries.id"), nullable=True)
    wastage_date = Column(Date, nullable=False)
    times_cooked = Column(Integer, nullable=False, default=0, server_default=text("0"))
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now())
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    user = relationship("User", foreign_keys=[user_id])
    items = relationship("WastageItem", back_populates="wastage_entry", cascade="all, delete-orphan")
    consumption_entry = relationship("ConsumptionEntry", back_populates="wastages")

class WastageItem(Base):
    __tablename__ = "wastage_items"
    id = Column(Integer, primary_key=True)
    wastage_entry_id = Column(Integer, ForeignKey("wastage_entries.id"), nullable=True)
    consumption_entry_id = Column(Integer, ForeignKey("consumption_entries.id"), nullable=True)
    wastage_date = Column(Date, nullable=False)
    menu_item_id = Column(Integer, ForeignKey("menu_items.id"), nullable=True)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=True)
    quantity = Column(Numeric(15, 3), nullable=False)
    approx_amount = Column(Numeric(15, 3), nullable=False, default=0, server_default=text("0"))
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now())
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    menu_item = relationship("MenuItem")
    item = relationship("Item")
    wastage_entry = relationship("WastageEntry", back_populates="items")
    consumption_entry = relationship("ConsumptionEntry", back_populates="wastage_items")

class StockAdjustment(Base):
    __tablename__ = "stock_adjustments"
    id = Column(Integer, primary_key=True)
    adjustment_date = Column(Date, nullable=False)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    adjusted_qty = Column(Numeric(15, 3), nullable=False)
    reason = Column(String(255), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

class VendorPayment(Base):
    __tablename__ = "vendor_payments"
    id = Column(Integer, primary_key=True)
    payment_date = Column(Date, nullable=False)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False)
    amount = Column(Numeric(15, 3), nullable=False)
    payment_mode = Column(String(30), nullable=False)
    reference_no = Column(String(100), nullable=True)
    remarks = Column(Text, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now())
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)

class StockLedger(Base):
    __tablename__ = "stock_ledger"
    id = Column(Integer, primary_key=True)
    txn_date = Column(Date, nullable=False)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    txn_type = Column(SmallInteger, nullable=False)
    ref_table = Column(String(100), nullable=False)
    ref_id = Column(Integer, nullable=False)
    qty_in = Column(Numeric(15, 3), nullable=False, default=0)
    qty_out = Column(Numeric(15, 3), nullable=False, default=0)
    unit_cost = Column(Numeric(15, 3), nullable=False, default=0)
    value_in = Column(Numeric(15, 3), nullable=False, default=0)
    value_out = Column(Numeric(15, 3), nullable=False, default=0)
    balance = Column(Numeric(15, 3), nullable=False, default=0)
    current_value = Column(Numeric(15, 3), nullable=False, default=0)
    status = Column(Integer, nullable=False, default=1, server_default=text("1"))
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now())
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)

# ==========================================
# 3. SYSTEM & SUMMARY TABLES
# ==========================================

class LoginHistory(Base):
    __tablename__ = "login_history"
    id = Column(Integer, primary_key=True)
    logged_in_at = Column(DateTime, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    login_identifier = Column(String(150), nullable=False)
    login_status = Column(String(20), nullable=False)
    failure_reason = Column(String(255), nullable=True)
    ip_address = Column(String(45), nullable=True)
    device_info = Column(String(255), nullable=True)
    user_agent = Column(Text, nullable=True)
    session_token = Column(Text, nullable=True)
    session_id = Column(String(64), nullable=True)
    logged_out_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

class ActivityLog(Base):
    __tablename__ = "activity_logs"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    activity_at = Column(DateTime, nullable=False, server_default=func.now())
    method = Column(String(10), nullable=False)
    endpoint = Column(String(255), nullable=False)
    action = Column(String(150), nullable=False)
    activity_status = Column(String(20), nullable=False, default="SUCCESS")
    reason = Column(String(255), nullable=True)
    http_status_code = Column(Integer, nullable=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    request_id = Column(String(64), nullable=True)
    session_id = Column(String(64), nullable=True)
    route_template = Column(String(255), nullable=True)
    duration_ms = Column(Integer, nullable=True)
    error_code = Column(String(64), nullable=True)
    meta = Column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now())
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)

class DailyStockSummary(Base):
    __tablename__ = "daily_stock_summary"
    id = Column(Integer, primary_key=True)
    summary_date = Column(Date, nullable=False)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    opening_stock = Column(Numeric(15, 3), nullable=False)
    purchased_qty = Column(Numeric(15, 3), nullable=False)
    consumed_qty = Column(Numeric(15, 3), nullable=False)
    wastage_qty = Column(Numeric(15, 3), nullable=False)
    adjustment_qty = Column(Numeric(15, 3), nullable=True)
    closing_stock = Column(Numeric(15, 3), nullable=False)
    avg_purchase_price = Column(Numeric(15, 2), nullable=True)
    stock_value = Column(Numeric(15, 2), nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now())

class MonthlyStockSummary(Base):
    __tablename__ = "monthly_stock_summary"
    id = Column(Integer, primary_key=True)
    summary_month = Column(Date, nullable=False)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    opening_stock = Column(Numeric(15, 3), nullable=False)
    total_purchased_qty = Column(Numeric(15, 3), nullable=False)
    total_consumed_qty = Column(Numeric(15, 3), nullable=False)
    total_wastage_qty = Column(Numeric(15, 3), nullable=False)
    total_adjustment_qty = Column(Numeric(15, 3), nullable=True)
    closing_stock = Column(Numeric(15, 3), nullable=False)
    avg_purchase_price = Column(Numeric(15, 2), nullable=True)
    closing_stock_value = Column(Numeric(15, 2), nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now())

# ==========================================
# 4. TOKEN SYSTEM (PARTITIONED)
# ==========================================

class TokenGeneration(Base):
    __tablename__ = "token_generations"
    id = Column(Integer, primary_key=True)
    date = Column(Date, unique=True, nullable=False)
    total_tokens = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now())
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    creator = relationship("User", foreign_keys=[created_by])

class TokenDetail(Base):
    __tablename__ = "token_details"
    id = Column(Integer, primary_key=True)
    generation_id = Column(Integer, ForeignKey("token_generations.id"), nullable=False)
    receipt_number = Column(Integer, nullable=False)
    token_count = Column(Integer, nullable=False)
    created_at = Column(DateTime, primary_key=True, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now())
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    creator = relationship("User", foreign_keys=[created_by])
    
    __table_args__ = (
        {"postgresql_partition_by": "RANGE (created_at)"}
    )
