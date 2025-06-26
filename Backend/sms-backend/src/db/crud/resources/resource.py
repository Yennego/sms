from typing import List, Optional, Dict, Any
from uuid import UUID
from sqlalchemy.orm import Session

from src.db.crud.base.base import TenantCRUDBase
from src.db.models.resources.resource import Resource
from src.schemas.resources.resource import ResourceCreate, ResourceUpdate


class CRUDResource(TenantCRUDBase[Resource, ResourceCreate, ResourceUpdate]):
    """CRUD operations for Resource model."""
    
    def get_by_uploader(self, db: Session, tenant_id: Any, uploader_id: Any) -> List[Resource]:
        """Get all resources uploaded by a specific user within a tenant."""
        return db.query(Resource).filter(
            Resource.tenant_id == tenant_id,
            Resource.uploader_id == uploader_id
        ).all()
    
    def get_by_subject(self, db: Session, tenant_id: Any, subject_id: Any) -> List[Resource]:
        """Get all resources for a specific subject within a tenant."""
        return db.query(Resource).filter(
            Resource.tenant_id == tenant_id,
            Resource.subject_id == subject_id
        ).all()
    
    def get_by_grade(self, db: Session, tenant_id: Any, grade_id: Any) -> List[Resource]:
        """Get all resources for a specific grade within a tenant."""
        return db.query(Resource).filter(
            Resource.tenant_id == tenant_id,
            Resource.grade_id == grade_id
        ).all()
    
    def get_public_resources(self, db: Session, tenant_id: Any) -> List[Resource]:
        """Get all public resources within a tenant."""
        return db.query(Resource).filter(
            Resource.tenant_id == tenant_id,
            Resource.is_public == "public"
        ).all()
    
    def increment_access_count(self, db: Session, tenant_id: Any, id: Any) -> Optional[Resource]:
        """Increment the access count for a resource within a tenant."""
        resource = db.query(Resource).filter(
            Resource.tenant_id == tenant_id,
            Resource.id == id
        ).first()
        
        if resource:
            resource.access_count += 1
            db.commit()
            db.refresh(resource)
        
        return resource


resource = CRUDResource(Resource)