import logging
from dotenv import load_dotenv
load_dotenv(override=True)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.chefs import router as chefs_router
from app.api.consumptions import router as consumptions_router
from app.api.dashboard import router as dashboard_router
from app.api.item_categories import router as item_categories_router
from app.api.items import router as items_router
from app.api.purchases import router as purchases_router
from app.api.notifications import router as notifications_router
from app.api.reports import router as reports_router
from app.api.stock_adjustments import router as stock_adjustments_router
from app.api.units import router as units_router
from app.api.users import router as users_router
from app.api.vendor_payments import router as vendor_payments_router
from app.api.vendors import router as vendors_router
from app.api.menu_items import router as menu_items_router
from app.api.wastages import router as wastages_router
from app.api.tokens import router as tokens_router
from app.middleware.exception_handlers import register_exception_handlers
from app.utils.tasks import run_daily_snapshot_task, run_monthly_summary_task, audit_stock_integrity
from apscheduler.schedulers.background import BackgroundScheduler

logging.basicConfig(level=logging.INFO)
app = FastAPI(title='Anegudde Temple Inventory API')

# STANDARDIZED CORS - ALLOWS EVERYTHING FOR NOW
app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=False,
    allow_methods=['*'],
    allow_headers=['*'],
)

scheduler = BackgroundScheduler()
@app.on_event('startup')
def startup_event():
    scheduler.start()

@app.on_event('shutdown')
def shutdown_event():
    scheduler.shutdown()

register_exception_handlers(app)

@app.get('/')
def read_root(): return {'status': 'live'}

app.include_router(auth_router)
app.include_router(chefs_router)
app.include_router(vendors_router)
app.include_router(menu_items_router)
app.include_router(items_router)
app.include_router(units_router)
app.include_router(item_categories_router)
app.include_router(purchases_router)
app.include_router(consumptions_router)
app.include_router(wastages_router)
app.include_router(vendor_payments_router)
app.include_router(stock_adjustments_router)
app.include_router(users_router)
app.include_router(notifications_router)
app.include_router(reports_router)
app.include_router(dashboard_router)
app.include_router(tokens_router)
