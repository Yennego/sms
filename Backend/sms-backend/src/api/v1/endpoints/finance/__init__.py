from fastapi import APIRouter
from . import fees, expenses

router = APIRouter()
router.include_router(fees.router, prefix="/fees", tags=["finance"])
router.include_router(expenses.router, prefix="/expenses", tags=["finance"])

__all__ = ["router"]
