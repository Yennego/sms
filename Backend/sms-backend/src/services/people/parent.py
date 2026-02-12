from typing import List, Optional, Dict, Any
from uuid import UUID

from src.db.crud import parent as parent_crud
from src.db.models.people import Parent, Student
from src.schemas.people import ParentCreate, ParentUpdate
from src.services.base.base import TenantBaseService, SuperAdminBaseService
from sqlalchemy.exc import SQLAlchemyError

from src.db.models.logging.activity_log import ActivityLog

class ParentService(TenantBaseService[Parent, ParentCreate, ParentUpdate]):
    """
    Service for managing parents within a tenant.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(crud=parent_crud, model=Parent, *args, **kwargs)

    async def delete(self, *, id: UUID) -> Optional[Parent]:
        """Delete a parent, handling dependencies manually."""
        # 1. Handle Activity Logs (set user_id to NULL)
        self.db.query(ActivityLog).filter(
            ActivityLog.user_id == id
        ).update({ActivityLog.user_id: None}, synchronize_session=False)
        self.db.commit()
        
        return await super().delete(id=id)
    
    async def get_by_student(self, student_id: UUID) -> List[Parent]:
        """Get parents of a specific student within the current tenant."""
        return parent_crud.get_by_student(self.db, tenant_id=self.tenant_id, student_id=student_id)
    
    async def add_student(self, parent_id: UUID, student_id: UUID) -> Optional[Parent]:
        """Add a student to a parent's list of students."""
        return parent_crud.add_student(self.db, tenant_id=self.tenant_id, parent_id=parent_id, student_id=student_id)
    
    async def remove_student(self, parent_id: UUID, student_id: UUID) -> Optional[Parent]:
        """Remove a student from a parent's list of students."""
        return parent_crud.remove_student(self.db, tenant_id=self.tenant_id, parent_id=parent_id, student_id=student_id)
    
    async def deactivate_parent(self, parent_id: UUID, date_left, reason: Optional[str] = None) -> Optional[Parent]:
        """Deactivate a parent."""
        parent = await self.get(id=parent_id)
        if not parent:
            return None
        
        parent.deactivate(date_left, reason)
        return await self.update(id=parent_id, obj_in={"status": "inactive", "deactivated_date": date_left, "deactivation_reason": reason})

    async def update_communication_preferences(self, parent_id: UUID, preferences: Dict[str, Any]) -> Parent:
        """Update a parent's communication preferences with validation."""
        parent = await self.get(id=parent_id)
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
        return await self.update(id=parent_id, obj_in={"communication_preferences": current_preferences})


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

