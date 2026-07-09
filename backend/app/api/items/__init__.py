from fastapi import APIRouter

from .create import router as create_router
from .list import router as list_router
from .get import router as get_router
from .update import router as update_router
from .delete import router as delete_router
from .ledger import router as ledger_router
from .get_by_serial import router as get_by_serial_router
from .next_code import router as next_code_router

router = APIRouter(prefix="/items", tags=["items"])
router.include_router(next_code_router)
router.include_router(get_by_serial_router)
router.include_router(ledger_router)
router.include_router(create_router)
router.include_router(list_router)
router.include_router(get_router)
router.include_router(update_router)
router.include_router(delete_router)
