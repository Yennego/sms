"""
Academic Year Validation Utility

Provides validation functions to ensure data integrity by preventing
modifications to completed academic years.
"""
from datetime import date
from uuid import UUID
from sqlalchemy.orm import Session

from src.db.crud.academics.academic_year_crud import academic_year_crud
from src.core.exceptions.business import EntityNotFoundError, BusinessRuleViolationError


def validate_academic_year_editable(
    db: Session, 
    academic_year_id: UUID, 
    tenant_id: UUID,
    operation: str = "modify"
) -> None:
    """
    Validates that an academic year is editable (not locked/completed).
    
    An academic year is considered locked when:
    - It is not the current year (is_current = False), AND
    - Its end date has passed (end_date < today)
    
    Args:
        db: Database session
        academic_year_id: UUID of the academic year to validate
        tenant_id: Tenant ID for multi-tenancy
        operation: Description of the operation being attempted (for error message)
    
    Raises:
        EntityNotFoundError: If academic year doesn't exist
        BusinessRuleViolationError: If academic year is locked
    """
    ay = academic_year_crud.get_by_id(db, tenant_id=tenant_id, id=academic_year_id)
    
    if not ay:
        raise EntityNotFoundError("AcademicYear", academic_year_id)
    
    # Check if academic year is completed and locked
    if not ay.is_current and ay.end_date and ay.end_date < date.today():
        raise BusinessRuleViolationError(
            f"Cannot {operation} data for Academic Year '{ay.name}'. "
            f"This academic year ended on {ay.end_date.strftime('%Y-%m-%d')} and is now locked. "
            f"Historical data cannot be modified to maintain data integrity."
        )


def is_academic_year_locked(db: Session, academic_year_id: UUID, tenant_id: UUID) -> bool:
    """
    Checks if an academic year is locked without raising an exception.
    
    Returns:
        True if locked, False if editable, False if not found
    """
    try:
        ay = academic_year_crud.get_by_id(db, tenant_id=tenant_id, id=academic_year_id)
        if not ay:
            return False
        return not ay.is_current and ay.end_date and ay.end_date < date.today()
    except Exception:
        return False
