from fastapi import APIRouter

from .monthly_performance import router as monthly_performance_router
from .vendor_outstanding import router as vendor_outstanding_router
from .generate_daily_summary import router as generate_daily_summary_router
from .backfill_daily_summaries import router as backfill_daily_summaries_router
from .generate_monthly_summary import router as generate_monthly_summary_router
from .run_audit import router as run_audit_router
from .daily_closing_stock import router as daily_closing_stock_router
from .stock_finance_card import router as stock_finance_card_router
from .stock_finance_pdf import router as stock_finance_pdf_router
from .purchases import router as purchases_router
from .consumptions import router as consumptions_router
from .wastages import router as wastages_router
from .donations import router as donations_router
from .stock_summary import router as stock_summary_router
from .manpower import router as manpower_router
from .tokens import router as tokens_router

router = APIRouter(prefix="/reports", tags=["reports"])
router.include_router(monthly_performance_router)
router.include_router(vendor_outstanding_router)
router.include_router(generate_daily_summary_router)
router.include_router(backfill_daily_summaries_router)
router.include_router(generate_monthly_summary_router)
router.include_router(run_audit_router)
router.include_router(daily_closing_stock_router)
router.include_router(stock_finance_card_router)
router.include_router(stock_finance_pdf_router)
router.include_router(purchases_router)
router.include_router(consumptions_router)
router.include_router(wastages_router)
router.include_router(donations_router)
router.include_router(stock_summary_router)
router.include_router(manpower_router)
router.include_router(tokens_router)
