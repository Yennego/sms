from typing import Any, TYPE_CHECKING
from sqlalchemy import Column, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship, declared_attr
import uuid

if TYPE_CHECKING:
    from ..tenant.tenant import Tenant  # Avoid circular imports

class TenantMixin:
    """Mixin that adds tenant_id foreign key for multi-tenancy support.
    
    This mixin provides tenant isolation by adding a tenant_id foreign key
    to the model. It also sets up a relationship with the Tenant model.
    
    Attributes:
        tenant_id (UUID): The foreign key to the tenant this record belongs to.
        tenant (Tenant): The relationship to the Tenant model.
    
    Usage:
        class MyModel(TenantMixin, Base):
            __tablename__ = "my_model"
            ...
    """
    
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False
    )
    
    # Relationship to Tenant model - must be declared_attr for mixins
    @declared_attr
    def tenant(cls):
        return relationship(
            "Tenant",
            lazy="joined"  # Eager load tenant by default
        )
    
    def __init__(self, **kwargs):
        if 'tenant_id' not in kwargs:
            raise ValueError("tenant_id is required")
            
        tenant_id = kwargs['tenant_id']
        if not isinstance(tenant_id, uuid.UUID):
            try:
                kwargs['tenant_id'] = uuid.UUID(str(tenant_id))
            except (ValueError, AttributeError, TypeError):
                raise ValueError("tenant_id must be a valid UUID")
                
        for key, value in kwargs.items():
            setattr(self, key, value)


