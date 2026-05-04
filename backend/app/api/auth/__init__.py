from fastapi import APIRouter

from .login import router as login_router
from .profile import router as profile_router
from .change_password import router as change_password_router

router = APIRouter(prefix="/auth", tags=["auth"])
router.include_router(login_router)
router.include_router(profile_router)
router.include_router(change_password_router)
