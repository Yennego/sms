from typing import Any, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from src.services.auth.admin_service import AdminService
from src.db.session import get_db
from src.schemas.auth.admin import Admin, AdminCreate, AdminUpdate
from src.core.auth.dependencies import has_any_role, get_current_user, has_permission
from src.schemas.auth import User
from src.core.exceptions.business import (
    BusinessLogicError,
    EntityNotFoundError,
    DuplicateEntityError,
    BusinessRuleViolationError
)

router = APIRouter()

# Admin endpoints
@router.post("/admins", response_model=Admin, status_code=status.HTTP_201_CREATED)
def create_admin(
    *,
    admin_service: AdminService = Depends(),
    admin_in: AdminCreate,
    current_user: User = Depends(has_any_role(["superadmin"]))
) -> Any:
    """Create a new admin (requires superadmin role)."""
    try:
        return admin_service.create(obj_in=admin_in)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.get("/admins", response_model=List[Admin])
def get_admins(
    *,
    admin_service: AdminService = Depends(),
    skip: int = 0,
    limit: int = 100,
    department: Optional[str] = None,
    admin_level: Optional[str] = None,
    current_user: User = Depends(has_any_role(["superadmin"]))
) -> Any:
    """Get all admins (requires superadmin role)."""
    if department:
        return admin_service.get_by_department(department)
    if admin_level:
        return admin_service.get_by_admin_level(admin_level)
    
    return admin_service.get_multi(skip=skip, limit=limit)

@router.get("/admins/{admin_id}", response_model=Admin)
def get_admin(
    *,
    admin_service: AdminService = Depends(),
    admin_id: UUID,
    current_user: User = Depends(has_any_role(["superadmin"]))
) -> Any:
    """Get a specific admin by ID (requires superadmin role)."""
    admin = admin_service.get(id=admin_id)
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Admin with ID {admin_id} not found"
        )
    return admin

@router.put("/admins/{admin_id}", response_model=Admin)
def update_admin(
    *,
    admin_service: AdminService = Depends(),
    admin_id: UUID,
    admin_in: AdminUpdate,
    current_user: User = Depends(has_any_role(["superadmin"]))
) -> Any:
    """Update an admin (requires superadmin role)."""
    try:
        admin = admin_service.get(id=admin_id)
        if not admin:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Admin with ID {admin_id} not found"
            )
        return admin_service.update(db_obj=admin, obj_in=admin_in)
    except BusinessLogicError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.delete("/admins/{admin_id}", response_model=Admin)
def delete_admin(
    *,
    admin_service: AdminService = Depends(),
    admin_id: UUID,
    current_user: User = Depends(has_any_role(["superadmin"]))
) -> Any:
    """Delete an admin (requires superadmin role)."""
    admin = admin_service.get(id=admin_id)
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Admin with ID {admin_id} not found"
        )
    return admin_service.remove(id=admin_id)