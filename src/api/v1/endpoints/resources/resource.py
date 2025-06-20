from typing import Any, List, Optional, Dict
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query, Body, File, UploadFile, Form
from sqlalchemy.orm import Session

from src.services.resources import ResourceService
from src.db.session import get_db
from src.schemas.resources.resource import Resource, ResourceCreate, ResourceUpdate, ResourceWithDetails
from src.core.middleware.tenant import get_tenant_from_request
from src.core.auth.dependencies import has_any_role, get_current_user, has_permission
from src.schemas.auth import User
from src.core.exceptions.business import EntityNotFoundError

router = APIRouter()

# Resource endpoints
@router.post("/resources", response_model=Resource, status_code=status.HTTP_201_CREATED)
def create_resource(
    *,
    resource_service: ResourceService = Depends(),
    resource_in: ResourceCreate,
    current_user: User = Depends(has_any_role(["admin", "teacher"]))
) -> Any:
    """Create a new resource (requires admin or teacher role)."""
    try:
        return resource_service.create(obj_in=resource_in)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.get("/resources", response_model=List[Resource])
def get_resources(
    *,
    resource_service: ResourceService = Depends(),
    skip: int = 0,
    limit: int = 100,
    uploader_id: Optional[UUID] = None,
    subject_id: Optional[UUID] = None,
    grade_id: Optional[UUID] = None,
    resource_type: Optional[str] = None,
    is_public: Optional[str] = None,
    current_user: User = Depends(get_current_user)
) -> Any:
    """Get all resources for a tenant with optional filtering."""
    filters = {}
    if uploader_id:
        filters["uploader_id"] = uploader_id
    if subject_id:
        filters["subject_id"] = subject_id
    if grade_id:
        filters["grade_id"] = grade_id
    if resource_type:
        filters["resource_type"] = resource_type
    if is_public:
        filters["is_public"] = is_public
    
    return resource_service.list(skip=skip, limit=limit, filters=filters)

@router.get("/resources/{id}", response_model=ResourceWithDetails)
def get_resource(
    *,
    resource_service: ResourceService = Depends(),
    id: UUID,
    current_user: User = Depends(get_current_user)
) -> Any:
    """Get a specific resource by ID."""
    try:
        # Access the resource, which updates access statistics
        return resource_service.access_resource(id=id)
    except EntityNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Resource with ID {id} not found"
        )

@router.put("/resources/{id}", response_model=Resource)
def update_resource(
    *,
    resource_service: ResourceService = Depends(),
    id: UUID,
    resource_in: ResourceUpdate,
    current_user: User = Depends(has_any_role(["admin", "teacher"]))
) -> Any:
    """Update a resource (requires admin or teacher role)."""
    try:
        resource = resource_service.get(id=id)
        if not resource:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Resource with ID {id} not found"
            )
        
        # Check if the current user is the uploader or an admin
        if current_user.role != "admin" and resource.uploader_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to update this resource"
            )
        
        return resource_service.update(id=id, obj_in=resource_in)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.delete("/resources/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_resource(
    *,
    resource_service: ResourceService = Depends(),
    id: UUID,
    current_user: User = Depends(has_any_role(["admin", "teacher"]))
) -> None: 
    """Delete a resource (requires admin or teacher role)."""
    resource = resource_service.get(id=id)
    if not resource:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Resource with ID {id} not found"
        )
    
    # Check if the current user is the uploader or an admin
    if current_user.role != "admin" and resource.uploader_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to delete this resource"
        )
    
    resource_service.delete(id=id)
    # Don't return anything for a 204 response