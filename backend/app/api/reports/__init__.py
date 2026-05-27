from fastapi import APIRouter

from .purchases import router as purchases_router
from .consumptions import router as consumptions_router
from .wastages import router as wastages_router
from .donations import router as donations_router
from .stock_summary import router as stock_summary_router
from .manpower import router as manpower_router

router = APIRouter(prefix="/reports", tags=["reports"])
router.include_router(purchases_router)
router.include_router(consumptions_router)
router.include_router(wastages_router)
router.include_router(donations_router)
router.include_router(stock_summary_router)
router.include_router(manpower_router)
