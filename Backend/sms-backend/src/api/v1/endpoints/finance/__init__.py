from fastapi import APIRouter, Depends, HTTPException, Request, status

from src.core.security.auth import get_current_active_user, is_super_admin
from src.db.models.auth import User
from src.services.tenant.features import require_feature
from . import fees, family, expenses


async def require_finance_access(request: Request, current_user: User = Depends(get_current_active_user)) -> User:
    """Expenses are staff-only: reads need view_financial_data, changes need manage_financial_data."""
    needed = "view_financial_data" if request.method == "GET" else "manage_financial_data"
    if is_super_admin(current_user) or any(
        p.name == needed for role in current_user.roles for p in role.permissions
    ):
        return current_user
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"User does not have permission: {needed}")


# Off while the school's enable_finance switch is off, except the family's list of children
# (the parent portal's child switcher), which then comes without fee figures
FINANCE_ON = Depends(require_feature("enable_finance"))
router = APIRouter()
# Fees: permissions per endpoint (phase5-design.md §4); the family routes check the parent/student link
router.include_router(fees.router, tags=["finance"], dependencies=[FINANCE_ON])
router.include_router(family.router, prefix="/family", tags=["finance"])
router.include_router(expenses.router, prefix="/expenses", tags=["finance"],
                      dependencies=[FINANCE_ON, Depends(require_finance_access)])

__all__ = ["router"]
