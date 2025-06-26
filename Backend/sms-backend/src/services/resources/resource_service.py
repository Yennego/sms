from typing import List, Optional, Dict, Any, Union
from uuid import UUID
from datetime import datetime

from src.db.crud.resources import resource as resource_crud
from src.db.models.resources.resource import Resource
from src.schemas.resources.resource import ResourceCreate, ResourceUpdate
from src.services.base.base import TenantBaseService, SuperAdminBaseService
from src.core.exceptions.business import EntityNotFoundError


class ResourceService(TenantBaseService[Resource, ResourceCreate, ResourceUpdate]):
    """Service for managing resources within a tenant."""
    
    def __init__(self, *args, **kwargs):
        super().__init__(crud=resource_crud, model=Resource, *args, **kwargs)
    
    def get_by_uploader(self, uploader_id: UUID) -> List[Resource]:
        """Get all resources uploaded by a specific user."""
        return resource_crud.get_by_uploader(
            self.db, tenant_id=self.tenant_id, uploader_id=uploader_id
        )
    
    def get_by_subject(self, subject_id: UUID) -> List[Resource]:
        """Get all resources for a specific subject."""
        return resource_crud.get_by_subject(
            self.db, tenant_id=self.tenant_id, subject_id=subject_id
        )
    
    def get_by_grade(self, grade_id: UUID) -> List[Resource]:
        """Get all resources for a specific grade."""
        return resource_crud.get_by_grade(
            self.db, tenant_id=self.tenant_id, grade_id=grade_id
        )
    
    def get_public_resources(self) -> List[Resource]:
        """Get all public resources."""
        return resource_crud.get_public_resources(
            self.db, tenant_id=self.tenant_id
        )
    
    def access_resource(self, id: UUID) -> Optional[Resource]:
        """Access a resource and update its access statistics."""
        resource = self.get(id=id)
        if not resource:
            raise EntityNotFoundError(f"Resource with ID {id} not found")
        
        # Update last accessed time and increment access count
        update_data = ResourceUpdate(
            last_accessed=datetime.now(),
            access_count=resource.access_count + 1
        )
        
        return self.update(id=id, obj_in=update_data)


class SuperAdminResourceService(SuperAdminBaseService[Resource, ResourceCreate, ResourceUpdate]):
    """Service for managing resources across all tenants (super admin only)."""
    
    def __init__(self, *args, **kwargs):
        super().__init__(crud=resource_crud, model=Resource, *args, **kwargs)