
import sys
import os
from sqlalchemy.orm import Session
from decimal import Decimal

# Ensure the app module can be found
sys.path.append(os.path.join(os.getcwd(), "backend"))

from app.db.models import Item, PurchaseItem, StockLedger, PurchaseEntry
from app.db.session import SessionLocal

def debug_stock_sync():
    db = SessionLocal()
    try:
        # 1. Check Rice (ID 1)
        rice = db.query(Item).filter(Item.id == 1).first()
        print(f"ITEM: {rice.item_name}")
        print(f"Current Stock in Item table: {rice.current_stock}")

        # 2. Check latest Purchases for Rice
        purchases = db.query(PurchaseItem).filter(PurchaseItem.item_id == 1).order_by(PurchaseItem.id.desc()).limit(5).all()
        print("\nRECENT PURCHASES FOR RICE:")
        for p in purchases:
            entry = db.query(PurchaseEntry).filter(PurchaseEntry.id == p.purchase_entry_id).first()
            print(f"Date: {p.purchase_date} | Qty: {p.quantity} | Entry Status: {entry.status if entry else 'N/A'}")

        # 3. Check Stock Ledger for Rice
        ledger = db.query(StockLedger).filter(StockLedger.item_id == 1).order_by(StockLedger.id.desc()).limit(5).all()
        print("\nRECENT STOCK LEDGER ENTRIES FOR RICE:")
        for l in ledger:
            print(f"Date: {l.txn_date} | Type: {l.txn_type} | Qty In: {l.qty_in} | Balance: {l.balance} | Status: {l.status}")

    finally:
        db.close()

if __name__ == "__main__":
    debug_stock_sync()
