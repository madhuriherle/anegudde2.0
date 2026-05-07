import logging
from datetime import date, datetime, timedelta
from decimal import Decimal

from sqlalchemy import func, case
from sqlalchemy.orm import Session

from app.db.models import DailyStockSummary, Item, StockLedger, MonthlyStockSummary
from app.db.session import SessionLocal

logger = logging.getLogger(__name__)

def generate_daily_stock_summary(summary_date: date):
    """
    Calculates and saves the stock summary for a specific date.
    Should be run after the day's operations are complete.
    """
    db: Session = SessionLocal()
    try:
        logger.info(f"Starting Daily Stock Summary generation for {summary_date}")
        
        # 1. Get all active items
        items = db.query(Item).filter(Item.status == 1).all()
        
        for item in items:
            # 2. Determine Opening Stock
            # Get yesterday's summary
            prev_date = summary_date - timedelta(days=1)
            prev_summary = db.query(DailyStockSummary).filter(
                DailyStockSummary.item_id == item.id,
                DailyStockSummary.summary_date == prev_date
            ).first()
            
            if prev_summary:
                opening_stock = prev_summary.closing_stock
            else:
                # If no previous summary, we use the opening_stock defined in the item table
                # This might be slightly inaccurate if the system has been running without summaries,
                # but it's the best starting point we have.
                opening_stock = item.opening_stock or Decimal("0")
            
            # 3. Aggregate transactions for this date
            ledger_data = db.query(
                func.sum(case((StockLedger.txn_type == 1, StockLedger.qty_in), else_=0)).label("purchased_qty"),
                func.sum(case((StockLedger.txn_type == 1, StockLedger.value_in), else_=0)).label("purchased_value"),
                func.sum(case((StockLedger.txn_type == 2, StockLedger.qty_out), else_=0)).label("consumed_qty"),
                func.sum(case((StockLedger.txn_type == 3, StockLedger.qty_out), else_=0)).label("wastage_qty"),
                func.sum(case((StockLedger.txn_type == 4, StockLedger.qty_in - StockLedger.qty_out), else_=0)).label("adjustment_qty")
            ).filter(
                StockLedger.item_id == item.id,
                StockLedger.txn_date == summary_date
            ).first()
            
            purchased_qty = ledger_data.purchased_qty or Decimal("0")
            purchased_value = ledger_data.purchased_value or Decimal("0")
            consumed_qty = ledger_data.consumed_qty or Decimal("0")
            wastage_qty = ledger_data.wastage_qty or Decimal("0")
            adjustment_qty = ledger_data.adjustment_qty or Decimal("0")
            
            # Calculate Closing Stock
            closing_stock = opening_stock + purchased_qty - consumed_qty - wastage_qty + adjustment_qty
            
            # Calculate average purchase price for the day
            avg_purchase_price = None
            if purchased_qty > 0:
                avg_purchase_price = purchased_value / purchased_qty
            
            # Stock Valuation
            # If no purchases today, try to get the last known average price from previous summaries
            valuation_price = avg_purchase_price
            if valuation_price is None:
                last_summary_with_price = db.query(DailyStockSummary).filter(
                    DailyStockSummary.item_id == item.id,
                    DailyStockSummary.avg_purchase_price != None
                ).order_by(DailyStockSummary.summary_date.desc()).first()
                
                if last_summary_with_price:
                    valuation_price = last_summary_with_price.avg_purchase_price
                else:
                    valuation_price = item.default_price or Decimal("0")
            
            stock_value = closing_stock * valuation_price
            
            # 4. Save or Update Summary
            existing = db.query(DailyStockSummary).filter(
                DailyStockSummary.item_id == item.id,
                DailyStockSummary.summary_date == summary_date
            ).first()
            
            if existing:
                existing.opening_stock = opening_stock
                existing.purchased_qty = purchased_qty
                existing.consumed_qty = consumed_qty
                existing.wastage_qty = wastage_qty
                existing.adjustment_qty = adjustment_qty
                existing.closing_stock = closing_stock
                existing.avg_purchase_price = avg_purchase_price
                existing.stock_value = stock_value
                existing.updated_at = datetime.now()
            else:
                db.add(DailyStockSummary(
                    summary_date=summary_date,
                    item_id=item.id,
                    financial_year_id=item.financial_year_id, # Inherit from item
                    opening_stock=opening_stock,
                    purchased_qty=purchased_qty,
                    consumed_qty=consumed_qty,
                    wastage_qty=wastage_qty,
                    adjustment_qty=adjustment_qty,
                    closing_stock=closing_stock,
                    avg_purchase_price=avg_purchase_price,
                    stock_value=stock_value
                ))
        
        db.commit()
        logger.info(f"Successfully generated Daily Stock Summary for {summary_date}")
    except Exception as e:
        db.rollback()
        logger.error(f"Error generating Daily Stock Summary for {summary_date}: {str(e)}")
    finally:
        db.close()

def run_daily_snapshot_task():
    """
    Task to be run by the scheduler.
    It takes a snapshot for 'yesterday'.
    """
    yesterday = date.today() - timedelta(days=1)
    generate_daily_stock_summary(yesterday)

def generate_monthly_stock_summary(summary_month: date):
    """
    Aggregates daily summaries for a specific month.
    summary_month should be the first day of the month (e.g., 2023-10-01).
    """
    db: Session = SessionLocal()
    try:
        # Get start and end dates of the month
        start_date = summary_month.replace(day=1)
        if start_date.month == 12:
            end_date = start_date.replace(year=start_date.year + 1, month=1) - timedelta(days=1)
        else:
            end_date = start_date.replace(month=start_date.month + 1) - timedelta(days=1)
        
        logger.info(f"Starting Monthly Stock Summary generation for {start_date.strftime('%Y-%m')}")
        
        items = db.query(Item).filter(Item.status == 1).all()
        
        for item in items:
            # Get opening stock (closing of previous month)
            prev_month_end = start_date - timedelta(days=1)
            prev_month_summary = db.query(MonthlyStockSummary).filter(
                MonthlyStockSummary.item_id == item.id,
                MonthlyStockSummary.summary_month == prev_month_end.replace(day=1)
            ).first()
            
            if prev_month_summary:
                opening_stock = prev_month_summary.closing_stock
            else:
                # Get opening stock from first daily summary of this month
                first_daily = db.query(DailyStockSummary).filter(
                    DailyStockSummary.item_id == item.id,
                    DailyStockSummary.summary_date >= start_date,
                    DailyStockSummary.summary_date <= end_date
                ).order_by(DailyStockSummary.summary_date.asc()).first()
                opening_stock = first_daily.opening_stock if first_daily else item.opening_stock or Decimal("0")

            # Aggregate daily summaries
            summary_data = db.query(
                func.sum(DailyStockSummary.purchased_qty).label("total_purchased"),
                func.sum(DailyStockSummary.consumed_qty).label("total_consumed"),
                func.sum(DailyStockSummary.wastage_qty).label("total_wastage"),
                func.sum(DailyStockSummary.adjustment_qty).label("total_adjustment"),
                func.avg(DailyStockSummary.avg_purchase_price).label("avg_price")
            ).filter(
                DailyStockSummary.item_id == item.id,
                DailyStockSummary.summary_date >= start_date,
                DailyStockSummary.summary_date <= end_date
            ).first()
            
            # Get closing stock from last daily summary of the month
            last_daily = db.query(DailyStockSummary).filter(
                DailyStockSummary.item_id == item.id,
                DailyStockSummary.summary_date >= start_date,
                DailyStockSummary.summary_date <= end_date
            ).order_by(DailyStockSummary.summary_date.desc()).first()
            
            if not last_daily:
                continue # No data for this month

            closing_stock = last_daily.closing_stock
            
            # Update or create
            existing = db.query(MonthlyStockSummary).filter(
                MonthlyStockSummary.item_id == item.id,
                MonthlyStockSummary.summary_month == start_date
            ).first()
            
            if existing:
                existing.opening_stock = opening_stock
                existing.total_purchased_qty = summary_data.total_purchased or 0
                existing.total_consumed_qty = summary_data.total_consumed or 0
                existing.total_wastage_qty = summary_data.total_wastage or 0
                existing.total_adjustment_qty = summary_data.total_adjustment or 0
                existing.closing_stock = closing_stock
                existing.avg_purchase_price = summary_data.avg_price
                existing.closing_stock_value = closing_stock * (summary_data.avg_price or item.default_price or Decimal("0"))
                existing.updated_at = datetime.now()
            else:
                db.add(MonthlyStockSummary(
                    summary_month=start_date,
                    item_id=item.id,
                    financial_year_id=item.financial_year_id, # Inherit from item
                    opening_stock=opening_stock,
                    total_purchased_qty=summary_data.total_purchased or 0,
                    total_consumed_qty=summary_data.total_consumed or 0,
                    total_wastage_qty=summary_data.total_wastage or 0,
                    total_adjustment_qty=summary_data.total_adjustment or 0,
                    closing_stock=closing_stock,
                    avg_purchase_price=summary_data.avg_price,
                    closing_stock_value=closing_stock * (summary_data.avg_price or item.default_price or Decimal("0"))
                ))
        
        db.commit()
        logger.info(f"Successfully generated Monthly Stock Summary for {start_date.strftime('%Y-%m')}")
    except Exception as e:
        db.rollback()
        logger.error(f"Error generating Monthly Stock Summary: {str(e)}")
    finally:
        db.close()

def run_monthly_summary_task():
    """Run summary for previous month"""
    today = date.today()
    first_of_this_month = today.replace(day=1)
    last_month_date = (first_of_this_month - timedelta(days=1)).replace(day=1)
    generate_monthly_stock_summary(last_month_date)

def audit_stock_integrity():
    """
    Compares Item.current_stock with the latest DailyStockSummary.closing_stock.
    Runs weekly.
    """
    db: Session = SessionLocal()
    try:
        yesterday = date.today() - timedelta(days=1)
        logger.info("Starting Stock Integrity Audit")
        
        mismatches = []
        items = db.query(Item).filter(Item.status == 1).all()
        
        for item in items:
            last_summary = db.query(DailyStockSummary).filter(
                DailyStockSummary.item_id == item.id,
                DailyStockSummary.summary_date == yesterday
            ).first()
            
            if last_summary:
                if abs(item.current_stock - last_summary.closing_stock) > Decimal("0.001"):
                    mismatches.append(f"{item.item_name}: Live={item.current_stock}, Snapshot={last_summary.closing_stock}")
        
        if mismatches:
            logger.warning(f"Stock integrity audit found {len(mismatches)} discrepancies.")
        else:
            logger.info("Stock integrity audit passed.")
            
    except Exception as e:
        logger.error(f"Error during stock audit: {str(e)}")
    finally:
        db.close()
