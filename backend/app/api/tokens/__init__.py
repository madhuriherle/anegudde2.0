from fastapi import APIRouter
router = APIRouter(prefix='/tokens', tags=['tokens'])
from . import create, list
