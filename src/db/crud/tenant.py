from typing import Any, Dict, Optional, Union, List
from uuid import UUID

from sqlalchemy.orm import Session

from src.db.crud.base import CRUDBase
from src.db.models.tenant import Tenant
from src.core.exceptions import ResourceNotFoundError, TenantNotFoundError


class CRUDTenant(CRUDBase[Tenant, Any, Any]):
    """CRUD operations for Tenant model."""
    
    def get_by_domain(self, db: Session, domain: str) -> Optional[Tenant]:
        """Get a tenant by domain."""
        tenant = db.query(Tenant).filter(Tenant.domain == domain).first()
        if not tenant:
            raise TenantNotFoundError(f"Tenant with domain {domain} not found")
        return tenant
    
    def get_by_header(self, db: Session, tenant_id: str) -> Optional[Tenant]:
        """Get a tenant by ID from header."""
        try:
            uuid_tenant_id = UUID(tenant_id)
            tenant = db.query(Tenant).filter(Tenant.id == uuid_tenant_id).first()
            if not tenant:
                raise TenantNotFoundError(f"Tenant with ID {tenant_id} not found")
            return tenant
        except ValueError:
            raise TenantNotFoundError(f"Invalid tenant ID format: {tenant_id}")
    
    def get_active_tenants(self, db: Session) -> List[Tenant]:
        """Get all active tenants."""
        return db.query(Tenant).filter(Tenant.is_active == True).all()


tenant = CRUDTenant(Tenant)


def get_tenant_by_domain(db: Session, domain: str) -> Optional[Tenant]:
    """Helper function to get tenant by domain."""
    return db.query(Tenant).filter(Tenant.domain == domain).first()


def get_tenant_by_header(db: Session, tenant_id: str) -> Optional[Tenant]:
    """Helper function to get tenant by ID from header."""
    try:
        uuid_tenant_id = UUID(tenant_id)
        return db.query(Tenant).filter(Tenant.id == uuid_tenant_id).first()
    except ValueError:
        return None