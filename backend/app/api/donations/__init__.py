from fastapi import APIRouter

from .create import router as create_router
from .list import router as list_router
from .get import router as get_router
from .delete import router as delete_router
from .update import router as update_router
from .devotee import router as devotee_router

router = APIRouter(prefix="/donations", tags=["donations"])
router.include_router(create_router)
router.include_router(list_router)
router.include_router(get_router)
router.include_router(delete_router)
router.include_router(update_router)
router.include_router(devotee_router)
