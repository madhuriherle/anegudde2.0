from fastapi import APIRouter

from .create import router as create_router
from .list import router as list_router
from .get import router as get_router
from .update import router as update_router
from .delete import router as delete_router
from .upload_bill import router as upload_bill_router
from .download_bill import router as download_bill_router
from .delete_bill import router as delete_bill_router
from .returns import router as returns_router

router = APIRouter(prefix="/purchases", tags=["purchases"])
router.include_router(create_router)
router.include_router(list_router)
router.include_router(get_router)
router.include_router(update_router)
router.include_router(delete_router)
router.include_router(upload_bill_router)
router.include_router(download_bill_router)
router.include_router(delete_bill_router)
router.include_router(returns_router)
