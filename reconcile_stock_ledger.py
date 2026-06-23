import os
import sys
from decimal import Decimal
from datetime import date, datetime

# Set up path to import app modules dynamically
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_path = os.path.join(current_dir, "backend")
if not os.path.exists(os.path.join(backend_path, "app")):
    backend_path = current_dir
sys.path.append(backend_path)

from app.db.session import SessionLocal
from app.db.models import Item, StockLedger

def main():
    # Detect environment database connection
    vps_env = "/var/www/anegudde/backend/.env"
    local_env = os.path.join(backend_path, ".env")
    
    env_path = None
    if os.path.exists(vps_env):
        env_path = vps_env
        print("Detected Environment: VPS")
    elif os.path.exists(local_env):
        env_path = local_env
        print("Detected Environment: LOCAL")
    else:
        fallback_env = os.path.join(os.getcwd(), "backend", ".env")
        if os.path.exists(fallback_env):
            env_path = fallback_env
            print("Detected Environment: FALLBACK LOCAL")

    database_url = None
    if env_path:
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line.startswith("DATABASE_URL="):
                    database_url = line.split("=", 1)[1]
                    break
                    
    if not database_url:
        print("ERROR: DATABASE_URL not found in .env")
        sys.exit(1)
        
    db = SessionLocal()
    try:
        print("Connecting to database...")
        items = db.query(Item).filter(Item.is_deleted == False, Item.status == 1).all()
        print(f"Fetched {len(items)} items from database.")
        today = date.today()
        now = datetime.now()
        
        print("\n--- Starting Stock Reconciliation ---")
        reconciled_count = 0
        
        for item in items:
            # 1. Sum up all ledger transactions for this item
            ledger_in = db.query(func.sum(StockLedger.qty_in)).filter(
                StockLedger.item_id == item.id,
                StockLedger.status == 1
            ).scalar() or Decimal("0")
            
            ledger_out = db.query(func.sum(StockLedger.qty_out)).filter(
                StockLedger.item_id == item.id,
                StockLedger.status == 1
            ).scalar() or Decimal("0")
            
            # The ledger balance is opening_stock + transactions
            base_opening = Decimal(str(item.opening_stock or 0))
            ledger_balance = base_opening + ledger_in - ledger_out
            live_stock = Decimal(str(item.current_stock or 0))
            diff = live_stock - ledger_balance
            
            if live_stock > 0 or ledger_balance > 0:
                print(f"Item: {item.item_name} (ID: {item.id}) | Live Stock: {live_stock:.3f} | Ledger Bal: {ledger_balance:.3f} | Diff: {diff:.3f}")
                
            # If there's a discrepancy, create a Stock Adjustment ledger entry to reconcile them
            if abs(diff) > Decimal("0.001"):
                print(f"Reconciling '{item.item_name}': Live={live_stock:.3f}, Ledger={ledger_balance:.3f}, Diff={diff:.3f}")
                
                qty_in = diff if diff > 0 else Decimal("0")
                qty_out = -diff if diff < 0 else Decimal("0")
                unit_cost = item.default_price or Decimal("0")
                
                reconcile_entry = StockLedger(
                    item_id=item.id,
                    txn_date=today,
                    txn_type=4,  # Stock Adjustment
                    ref_table="reconciliation",
                    ref_id=item.id,
                    qty_in=qty_in,
                    qty_out=qty_out,
                    unit_cost=unit_cost,
                    value_in=qty_in * unit_cost,
                    value_out=qty_out * unit_cost,
                    balance=live_stock,
                    current_value=live_stock * unit_cost,
                    created_at=now,
                    updated_at=now,
                    created_by=1,  # System/Admin default
                    updated_by=1,
                )
                db.add(reconcile_entry)
                reconciled_count += 1
                
        # Print all ledger transactions for Rice (item_id = 1) to inspect their dates, types, and status
        rice_txns = db.query(StockLedger).filter(StockLedger.item_id == 1).order_by(StockLedger.txn_date.asc()).all()
        print(f"\n--- Rice (ID: 1) Transaction History ({len(rice_txns)} entries) ---")
        for t in rice_txns:
            print(f"Date: {t.txn_date} | Type: {t.txn_type} | Qty In: {t.qty_in:.3f} | Qty Out: {t.qty_out:.3f} | Status: {t.status} | Ref: {t.ref_table}:{t.ref_id}")

        # Simulate get_detailed_stock_summary for today (June 23, 2026)
        from_date = date(2026, 6, 23)
        to_date = date(2026, 6, 23)
        
        # Calculate opening balance
        net_before = db.query(
            func.coalesce(func.sum(StockLedger.qty_in - StockLedger.qty_out), 0)
        ).filter(StockLedger.item_id == 1, StockLedger.txn_date < from_date, StockLedger.status == 1).scalar() or Decimal("0")
        
        rice_item = db.query(Item).filter(Item.id == 1).first()
        base_opening = Decimal(rice_item.opening_stock or 0)
        ob = base_opening + net_before
        
        # Calculate period stats
        p_stats = db.query(
            func.coalesce(func.sum(case((StockLedger.txn_type == 1, StockLedger.qty_in), else_=0)), 0).label("purchase_qty"),
            func.coalesce(func.sum(case((StockLedger.txn_type == 2, StockLedger.qty_out), else_=0)), 0).label("issue_qty"),
            func.coalesce(
                func.sum(
                    case(
                        (StockLedger.ref_table == "consumption_entries:RAW_RETURN", StockLedger.qty_in - StockLedger.qty_out),
                        (StockLedger.ref_table == "stock_adjustments", StockLedger.qty_in - StockLedger.qty_out),
                        (StockLedger.txn_type == 4, StockLedger.qty_in - StockLedger.qty_out),
                        (StockLedger.txn_type == 7, StockLedger.qty_in - StockLedger.qty_out),
                        (StockLedger.txn_type == 8, StockLedger.qty_in - StockLedger.qty_out),
                        else_=0
                    )
                ),
                0
            ).label("stock_adjustment_qty"),
            func.coalesce(func.sum(StockLedger.qty_in), 0).label("total_qty_in"),
            func.coalesce(func.sum(StockLedger.qty_out), 0).label("total_qty_out"),
        ).filter(
            StockLedger.item_id == 1,
            StockLedger.txn_date >= from_date,
            StockLedger.txn_date <= to_date,
            StockLedger.status == 1
        ).first()
        
        closing = ob + Decimal(str(p_stats.total_qty_in)) - Decimal(str(p_stats.total_qty_out))
        
        print(f"\n--- API Simulation for Rice (Item 1) on {from_date} ---")
        print(f"Opening Balance: {ob:.3f}")
        print(f"Added (Purchase): {p_stats.purchase_qty:.3f}")
        print(f"Used (Issues): {p_stats.issue_qty:.3f}")
        print(f"Stock Adjustments: {p_stats.stock_adjustment_qty:.3f}")
        print(f"Closing Stock: {closing:.3f}")

        if reconciled_count > 0:
            db.commit()
            print(f"\nSuccessfully reconciled {reconciled_count} item(s).")
        else:
            print("\nNo discrepancies found. All ledger balances match live stocks.")
            
    except Exception as e:
        db.rollback()
        print(f"Error during reconciliation: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    from sqlalchemy import func, case
    main()
