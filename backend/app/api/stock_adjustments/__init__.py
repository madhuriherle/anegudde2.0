from fastapi import APIRouter
from .create import router as create_router
from .list import router as list_router
router = APIRouter(prefix="/stock-adjustments", tags=["stock-adjustments"])
router.include_router(create_router)
router.include_router(list_router)
