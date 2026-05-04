from fastapi import APIRouter

from .stock_trend import router as stock_trend_router
from .recent_activity import router as recent_activity_router
from .overview import router as overview_router
from .today import router as today_router
from .low_stock import router as low_stock_router

router = APIRouter(prefix="/dashboard", tags=["dashboard"])
router.include_router(stock_trend_router)
router.include_router(recent_activity_router)
router.include_router(overview_router)
router.include_router(today_router)
router.include_router(low_stock_router)
