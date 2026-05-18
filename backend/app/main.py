import os
import logging
from datetime import datetime, date
from dotenv import load_dotenv

# Find the absolute path to backend/.env
current_file_path = os.path.abspath(__file__)
backend_dir = os.path.dirname(os.path.dirname(current_file_path))
env_path = os.path.join(backend_dir, ".env")
load_dotenv(dotenv_path=env_path, override=True)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.auth import router as auth_router
from app.api.usage_entries import router as usage_entries_router
from app.api.dashboard import router as dashboard_router
from app.api.item_categories import router as item_categories_router
from app.api.item_types import router as item_types_router
from app.api.items import router as items_router
from app.api.purchases import router as purchases_router
from app.api.reports import router as reports_router
from app.api.stock_adjustments import router as stock_adjustments_router
from app.api.units import router as units_router
from app.api.users import router as users_router
from app.api.vendors import router as vendors_router
from app.api.menu_items import router as menu_items_router
from app.api.wastages import router as wastages_router
from app.api.tokens import router as tokens_router
from app.api.donations import router as donations_router
from app.api.donation_types import router as donation_types_router
from app.api.settings import router as settings_router
from app.api.debug import router as system_router
from app.middleware.exception_handlers import register_exception_handlers
from app.middleware.activity_audit import ActivityAuditMiddleware
from app.utils.tasks import run_daily_snapshot_task, run_monthly_summary_task, audit_stock_integrity
from app.db.session import SessionLocal
from app.db.models import FinancialYear, SystemSettings
from apscheduler.schedulers.background import BackgroundScheduler

logging.basicConfig(level=logging.INFO)
app = FastAPI(title='Anegudde Temple Inventory API')

app.add_middleware(ActivityAuditMiddleware)

# STANDARDIZED CORS - ALLOWS FRONTEND ORIGINS
app.add_middleware(
    CORSMiddleware,
allow_origins=[
    "http://localhost:5176",
    "http://127.0.0.1:5176",
    "http://localhost:5175",
    "http://127.0.0.1:5175",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

scheduler = BackgroundScheduler()

def _get_financial_year_bounds(today: date) -> tuple[str, date, date]:
    if today.month >= 4:
        start_year = today.year
    else:
        start_year = today.year - 1
    end_year = start_year + 1
    name = f"{start_year}-{str(end_year)[-2:]}"
    return name, date(start_year, 4, 1), date(end_year, 3, 31)

def _ensure_active_financial_year() -> None:
    db = SessionLocal()
    try:
        fy_name, fy_start, fy_end = _get_financial_year_bounds(date.today())
        target = db.query(FinancialYear).filter(FinancialYear.name == fy_name).first()

        if not target:
            target = FinancialYear(
                name=fy_name,
                start_date=fy_start,
                end_date=fy_end,
                is_active=True,
                status=1,
            )
            db.add(target)
            db.flush()

        # Keep current FY active and enabled
        target.start_date = fy_start
        target.end_date = fy_end
        target.status = 1

        # Ensure exactly one active FY
        db.query(FinancialYear).update({FinancialYear.is_active: False}, synchronize_session=False)
        target.is_active = True
        
        # ALSO UPDATE SYSTEM SETTINGS to point to this FY
        settings = db.query(SystemSettings).first()
        if settings:
            settings.current_financial_year_id = target.id
            
        db.commit()
    except Exception:
        db.rollback()
        logging.exception("Failed to auto-rollover financial year")
    finally:
        db.close()

def _ensure_token_partitions(years_ahead: int = 1) -> None:
    db = SessionLocal()
    try:
        table_exists = db.execute(text("SELECT to_regclass('public.token_details')")).scalar()
        if not table_exists:
            return

        current_year = datetime.now().year
        for year in range(current_year, current_year + years_ahead + 1):
            for month in range(1, 13):
                partition_name = f"token_details_{year}_{month:02d}"
                start_date = f"{year}-{month:02d}-01"
                end_date = f"{year + 1}-01-01" if month == 12 else f"{year}-{month + 1:02d}-01"
                db.execute(text(f"""
                    CREATE TABLE IF NOT EXISTS {partition_name}
                    PARTITION OF token_details
                    FOR VALUES FROM ('{start_date}') TO ('{end_date}');
                """))
        db.commit()
    except Exception:
        db.rollback()
        logging.exception("Failed to ensure token partitions on startup")
    finally:
        db.close()

@app.on_event('startup')
def startup_event():
    _ensure_active_financial_year()
    _ensure_token_partitions(years_ahead=1)
    scheduler.add_job(_ensure_active_financial_year, trigger='cron', hour=0, minute=1, id='fy-rollover', replace_existing=True)
    scheduler.start()

@app.on_event('shutdown')
def shutdown_event():
    scheduler.shutdown()

register_exception_handlers(app)

@app.get('/')
def read_root(): return {'status': 'live'}

app.include_router(auth_router)
app.include_router(vendors_router)
app.include_router(menu_items_router)
app.include_router(items_router)
app.include_router(units_router)
app.include_router(item_types_router)
app.include_router(item_categories_router)
app.include_router(purchases_router)
app.include_router(usage_entries_router)
app.include_router(wastages_router)
app.include_router(stock_adjustments_router)
app.include_router(users_router)
app.include_router(reports_router)
app.include_router(dashboard_router)
app.include_router(tokens_router)
app.include_router(donations_router)
app.include_router(donation_types_router)
app.include_router(settings_router)
app.include_router(system_router)
