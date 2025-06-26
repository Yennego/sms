from typing import List, Optional, Dict, Any
from uuid import UUID

from src.db.crud import parent as parent_crud
from src.db.models.people import Parent, Student
from src.schemas.people import ParentCreate, ParentUpdate
from src.services.base.base import TenantBaseService, SuperAdminBaseService
from sqlalchemy.exc import SQLAlchemyError

class ParentService(TenantBaseService[Parent, ParentCreate, ParentUpdate]):
    """
    Service for managing parents within a tenant.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(crud=parent_crud, model=Parent, *args, **kwargs)
    
    def get_by_student(self, student_id: UUID) -> List[Parent]:
        """Get parents of a specific student within the current tenant."""
        return parent_crud.get_by_student(self.db, tenant_id=self.tenant_id, student_id=student_id)
    
    def add_student(self, parent_id: UUID, student_id: UUID) -> Optional[Parent]:
        """Add a student to a parent's list of students."""
        return parent_crud.add_student(self.db, tenant_id=self.tenant_id, parent_id=parent_id, student_id=student_id)
    
    def remove_student(self, parent_id: UUID, student_id: UUID) -> Optional[Parent]:
        """Remove a student from a parent's list of students."""
        return parent_crud.remove_student(self.db, tenant_id=self.tenant_id, parent_id=parent_id, student_id=student_id)
    
    def deactivate_parent(self, parent_id: UUID, date_left, reason: Optional[str] = None) -> Optional[Parent]:
        """Deactivate a parent."""
        parent = self.get(id=parent_id)
        if not parent:
            return None
        
        parent.deactivate(date_left, reason)
        return self.update(id=parent_id, obj_in={"status": "inactive", "deactivated_date": date_left, "deactivation_reason": reason})


class SuperAdminParentService(SuperAdminBaseService[Parent, ParentCreate, ParentUpdate]):
    """
    Super-admin service for managing parents across all tenants.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(crud=parent_crud, model=Parent, *args, **kwargs)
    
    def get_all_parents(self, skip: int = 0, limit: int = 100,
                       status: Optional[str] = None,
                       tenant_id: Optional[UUID] = None) -> List[Parent]:
        """Get all parents across all tenants with filtering."""
        query = self.db.query(Parent)
        
        # Apply filters
        if status:
            query = query.filter(Parent.status == status)
        if tenant_id:
            query = query.filter(Parent.tenant_id == tenant_id)
        
        # Apply pagination
        return query.offset(skip).limit(limit).all()
    
    def get_parents_by_student_across_tenants(self, student_id: UUID) -> List[Parent]:
        """Get all parents of a specific student across all tenants."""
        return self.db.query(Parent).join(
            Parent.students
        ).filter(
            Student.id == student_id
        ).all()


# Add to ParentService class
def add_multiple_students(self, parent_id: UUID, student_ids: List[UUID]) -> Optional[Parent]:
    """Add multiple students to a parent with transaction support.
    
    This operation is atomic - either all students are added or none are.
    
    Args:
        parent_id: The UUID of the parent
        student_ids: List of student UUIDs to add to the parent
        
    Returns:
        Updated Parent object or None if parent not found
        
    Raises:
        ValueError: If any student doesn't exist or already has this parent
        DatabaseError: If a database error occurs during the transaction
    """
    parent = self.get(id=parent_id)
    if not parent:
        return None
    
    # Start a transaction
    try:
        # Verify all students exist before making changes
        for student_id in student_ids:
            student = self.db.query(Student).filter(
                Student.id == student_id,
                Student.tenant_id == self.tenant_id
            ).first()
            if not student:
                raise ValueError(f"Student with ID {student_id} not found")
        
        # Add all students in a single transaction
        for student_id in student_ids:
            parent_crud.add_student(
                self.db, 
                tenant_id=self.tenant_id, 
                parent_id=parent_id, 
                student_id=student_id,
                commit=False  # Don't commit yet
            )
        
        # Commit the transaction
        self.db.commit()
        return parent
    except SQLAlchemyError as e:
        # Rollback on error
        self.db.rollback()
        raise DatabaseError(f"Database error occurred: {str(e)}") from e


# Add to ParentService class
def update_communication_preferences(self, parent_id: UUID, preferences: Dict[str, Any]) -> Parent:
    """Update a parent's communication preferences.
    
    Communication preferences can include:
    - Preferred contact method (email, SMS, phone, app)
    - Notification frequency (daily, weekly, immediate)
    - Types of notifications (attendance, grades, behavior, events)
    - Language preference
    - Time restrictions (e.g., do not contact between 10pm-6am)
    """
    parent = self.get(id=parent_id)
    if not parent:
        raise EntityNotFoundError("Parent", parent_id)
    
    # Validate communication preferences
    valid_contact_methods = ["email", "sms", "phone", "app"]
    valid_frequencies = ["daily", "weekly", "immediate"]
    valid_notification_types = ["attendance", "grades", "behavior", "events", "emergency"]
    
    if "contact_method" in preferences and preferences["contact_method"] not in valid_contact_methods:
        raise ValueError(f"Invalid contact method. Must be one of: {', '.join(valid_contact_methods)}")
    
    if "frequency" in preferences and preferences["frequency"] not in valid_frequencies:
        raise ValueError(f"Invalid frequency. Must be one of: {', '.join(valid_frequencies)}")
    
    if "notification_types" in preferences:
        for notification_type in preferences["notification_types"]:
            if notification_type not in valid_notification_types:
                raise ValueError(f"Invalid notification type: {notification_type}")
    
    # Get current preferences or initialize
    current_preferences = parent.communication_preferences or {}
    
    # Update preferences
    current_preferences.update(preferences)
    
    # Save updated preferences
    return self.update(id=parent_id, obj_in={"communication_preferences": current_preferences})