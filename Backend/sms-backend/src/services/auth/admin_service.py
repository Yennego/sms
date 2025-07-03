from typing import List, Optional, Dict, Any
from uuid import UUID

from src.db.crud.auth import admin_crud
from src.db.models.auth.admin import Admin
from src.schemas.auth.admin import AdminCreate, AdminUpdate
from src.services.base.base import SuperAdminBaseService
from src.core.exceptions.business import EntityNotFoundError, DuplicateEntityError


class AdminService(SuperAdminBaseService[Admin, AdminCreate, AdminUpdate]):
    """Service for managing admins."""
    
    def __init__(self, *args, **kwargs):
        super().__init__(crud=admin_crud, model=Admin, *args, **kwargs)
    
    def get_by_email(self, email: str) -> Optional[Admin]:
        """Get an admin by email."""
        return admin_crud.get_by_email(self.db, email=email)
    
    def get_by_department(self, department: str) -> List[Admin]:
        """Get admins by department."""
        return admin_crud.get_by_department(self.db, department=department)
    
    def get_by_admin_level(self, admin_level: str) -> List[Admin]:
        """Get admins by admin level."""
        return admin_crud.get_by_admin_level(self.db, admin_level=admin_level)
    
    def get_active_admins(self) -> List[Admin]:
        """Get all active admins."""
        return admin_crud.get_active_admins(self.db)
    
    def create(self, *, obj_in: AdminCreate) -> Admin:
        """Create a new admin with validation."""
        # Check for duplicate email
        existing = self.get_by_email(obj_in.email)
        if existing:
            raise DuplicateEntityError("Admin", "email", obj_in.email)
        
        # Create the admin
        return self.crud.create(db=self.db, obj_in=obj_in)

