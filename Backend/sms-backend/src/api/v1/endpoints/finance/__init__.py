from fastapi import APIRouter, Depends, HTTPException, Request, status

from src.core.security.auth import get_current_active_user, is_super_admin
from src.db.models.auth import User
from . import fees, expenses


async def require_finance_access(request: Request, current_user: User = Depends(get_current_active_user)) -> User:
    """Finance is staff-only: reads need view_financial_data, changes need manage_financial_data."""
    needed = "view_financial_data" if request.method == "GET" else "manage_financial_data"
    if is_super_admin(current_user) or any(
        p.name == needed for role in current_user.roles for p in role.permissions
    ):
        return current_user
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"User does not have permission: {needed}")


router = APIRouter(dependencies=[Depends(require_finance_access)])
router.include_router(fees.router, prefix="/fees", tags=["finance"])
router.include_router(expenses.router, prefix="/expenses", tags=["finance"])

__all__ = ["router"]
