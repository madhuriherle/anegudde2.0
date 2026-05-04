from fastapi import APIRouter
from .list import router as list_router
from .mark_read import router as mark_read_router
from .mark_all_read import router as mark_all_read_router
router = APIRouter(prefix="/notifications", tags=["notifications"])
router.include_router(list_router)
router.include_router(mark_read_router)
router.include_router(mark_all_read_router)
