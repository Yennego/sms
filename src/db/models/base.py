import uuid
from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy import Column, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.declarative import as_declarative, declared_attr
from sqlalchemy.orm import relationship, Session

from src.db.base import Base, UUIDMixin, TimestampMixin, TenantMixin


@as_declarative()
class Base:
    id: Any
    __name__: str
    
    # Generate __tablename__ automatically
    @declared_attr
    def __tablename__(cls) -> str:
        return cls.__name__.lower()


class UUIDMixin:
    """Mixin that adds a UUID primary key column."""
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)


class TimestampMixin:
    """Mixin that adds created_at and updated_at columns."""
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class TenantMixin:
    """Mixin that adds tenant_id foreign key column."""
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenant.id"), nullable=False, index=True)
    tenant = relationship("Tenant", back_populates="tenant_objects")


class TenantModel(Base):
    """Base model class for all tenant-scoped models."""
    __abstract__ = True

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    tenant_id = Column(String, nullable=False)

    @classmethod
    def get_tenant_id(cls, db: Session) -> str:
        """Get the current tenant ID from the request context."""
        from src.core.middleware.tenant import get_current_tenant_id
        return get_current_tenant_id()

    @declared_attr
    def __table_args__(cls):
        """Combine model-specific table args with tenant-specific constraints."""
        args = getattr(cls, '_additional_table_args', ())
        if not isinstance(args, tuple):
            args = (args,)
        return args