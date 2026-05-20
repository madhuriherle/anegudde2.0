from fastapi import APIRouter
from .list import router as list_router

router = APIRouter(prefix="/audit", tags=["audit"])
router.include_router(list_router)
