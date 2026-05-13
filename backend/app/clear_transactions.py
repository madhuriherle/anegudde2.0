from app.db.session import SessionLocal
from app.db.models import (
    PurchaseEntry, PurchaseItem, PurchaseBill,
    ConsumptionEntry, ConsumptionItem,
    WastageEntry, WastageItem,
    StockAdjustment, VendorPayment,
    StockLedger, ItemPrice,
    DailyStockSummary, MonthlyStockSummary,
    Item, Vendor
)

def clear_all_transactions():
    db = SessionLocal()
    try:
        # 1. Delete all transaction records (Order matters due to foreign keys)
        print("Clearing Wastage Items...")
        db.query(WastageItem).delete()
        print("Clearing Wastage Entries...")
        db.query(WastageEntry).delete()

        print("Clearing Consumption Items...")
        db.query(ConsumptionItem).delete()
        print("Clearing Consumption Entries...")
        db.query(ConsumptionEntry).delete()

        # ItemPrice depends on PurchaseEntry, so it must be deleted BEFORE PurchaseEntry
        print("Clearing Item Price History...")
        db.query(ItemPrice).delete()

        print("Clearing Purchase Bills...")
        db.query(PurchaseBill).delete()
        print("Clearing Purchase Items...")
        db.query(PurchaseItem).delete()
        print("Clearing Purchase Entries...")
        db.query(PurchaseEntry).delete()

        print("Clearing Stock Adjustments...")
        db.query(StockAdjustment).delete()
        
        print("Clearing Vendor Payments...")
        db.query(VendorPayment).delete()

        print("Clearing Stock Ledger...")
        db.query(StockLedger).delete()

        print("Clearing Summary Reports...")
        db.query(DailyStockSummary).delete()
        db.query(MonthlyStockSummary).delete()

        # 2. Reset Item Master Data
        print("Resetting Item Stocks and Prices to 0...")
        items = db.query(Item).all()
        for item in items:
            item.current_stock = 0
            item.opening_stock = 0
            item.default_price = 0

        # 3. Reset Vendor Balances
        print("Resetting Vendor Opening Balances to 0...")
        vendors = db.query(Vendor).all()
        for vendor in vendors:
            vendor.opening_balance = 0

        db.commit()
        print("System reset completed successfully. All history wiped and quantities set to 0.")
        
    except Exception as e:
        db.rollback()
        print(f"Error during system reset: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    clear_all_transactions()
