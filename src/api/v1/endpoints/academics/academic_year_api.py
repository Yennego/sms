from typing import Any, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from src.api.deps import get_db, get_current_active_user
from src.core.security.permissions import has_permission
from src.db.models.auth import User
from src.schemas.academics.academic_year import (
    AcademicYear,
    AcademicYearCreate,
    AcademicYearUpdate,
)
from src.services.academics.academic_year_service import (
    AcademicYearService,
    SuperAdminAcademicYearService,
)

router = APIRouter()


@router.post("/", response_model=AcademicYear, status_code=status.HTTP_201_CREATED)
def create_academic_year(
    *,
    db: Session = Depends(get_db),
    academic_year_in: AcademicYearCreate,
    current_user: User = Depends(has_permission("academic_year:create")),
) -> Any:
    """
    Create new academic year.
    """
    service = AcademicYearService(db)
    return service.create_academic_year(
        academic_year_data=academic_year_in,
        created_by_id=current_user.id,
        tenant_id=current_user.tenant_id,
    )


@router.get("/", response_model=List[AcademicYear])
def read_academic_years(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    is_active: Optional[bool] = Query(None),
) -> Any:
    """
    Retrieve academic years.
    """
    service = AcademicYearService(db)
    return service.get_academic_years(
        tenant_id=current_user.tenant_id,
        skip=skip,
        limit=limit,
        is_active=is_active,
    )


@router.get("/current", response_model=AcademicYear)
def read_current_academic_year(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Get current academic year.
    """
    service = AcademicYearService(db)
    academic_year = service.get_current_academic_year(tenant_id=current_user.tenant_id)
    if not academic_year:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No current academic year found",
        )
    return academic_year


@router.get("/current/semester", response_model=dict)
def read_current_semester(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Get current semester information.
    """
    service = AcademicYearService(db)
    academic_year = service.get_current_academic_year(tenant_id=current_user.tenant_id)
    if not academic_year:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No current academic year found",
        )
    
    current_semester = academic_year.get_current_semester()
    if not current_semester:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active semester found",
        )
    
    return {
        "academic_year_id": academic_year.id,
        "academic_year_name": academic_year.name,
        "current_semester": current_semester,
    }


@router.get("/{academic_year_id}", response_model=AcademicYear)
def read_academic_year(
    *,
    db: Session = Depends(get_db),
    academic_year_id: UUID,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Get academic year by ID.
    """
    service = AcademicYearService(db)
    academic_year = service.get_academic_year(
        academic_year_id=academic_year_id,
        tenant_id=current_user.tenant_id,
    )
    if not academic_year:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Academic year not found",
        )
    return academic_year


@router.put("/{academic_year_id}", response_model=AcademicYear)
def update_academic_year(
    *,
    db: Session = Depends(get_db),
    academic_year_id: UUID,
    academic_year_in: AcademicYearUpdate,
    current_user: User = Depends(has_permission("academic_year:update")),
) -> Any:
    """
    Update an academic year.
    """
    service = AcademicYearService(db)
    academic_year = service.update_academic_year(
        academic_year_id=academic_year_id,
        academic_year_data=academic_year_in,
        tenant_id=current_user.tenant_id,
    )
    if not academic_year:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Academic year not found",
        )
    return academic_year


@router.delete("/{academic_year_id}")
def delete_academic_year(
    *,
    db: Session = Depends(get_db),
    academic_year_id: UUID,
    current_user: User = Depends(has_permission("academic_year:delete")),
) -> Any:
    """
    Delete an academic year.
    """
    service = AcademicYearService(db)
    success = service.delete_academic_year(
        academic_year_id=academic_year_id,
        tenant_id=current_user.tenant_id,
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Academic year not found",
        )
    return {"message": "Academic year deleted successfully"}


@router.put("/{academic_year_id}/set-current", response_model=AcademicYear)
def set_current_academic_year(
    *,
    db: Session = Depends(get_db),
    academic_year_id: UUID,
    current_user: User = Depends(has_permission("academic_year:update")),
) -> Any:
    """
    Set an academic year as current.
    """
    service = AcademicYearService(db)
    academic_year = service.set_current_academic_year(
        academic_year_id=academic_year_id,
        tenant_id=current_user.tenant_id,
    )
    if not academic_year:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Academic year not found",
        )
    return academic_year


@router.put("/{academic_year_id}/advance-semester", response_model=AcademicYear)
def advance_semester(
    *,
    db: Session = Depends(get_db),
    academic_year_id: UUID,
    current_user: User = Depends(has_permission("academic_year:update")),
) -> Any:
    """
    Advance to the next semester in the academic year.
    """
    service = AcademicYearService(db)
    academic_year = service.advance_semester(
        academic_year_id=academic_year_id,
        tenant_id=current_user.tenant_id,
    )
    if not academic_year:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Academic year not found or no next semester available",
        )
    return academic_year