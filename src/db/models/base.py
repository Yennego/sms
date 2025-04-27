import uuid
from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy import Column, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.declarative import as_declarative, declared_attr
from sqlalchemy.orm import relationship


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


class TenantModel(UUIDMixin, TimestampMixin, TenantMixin, Base):
    """Abstract base class for all tenant-specific models."""
    __abstract__ = True
    
    @classmethod
    def get_by_id(cls, db_session, id: uuid.UUID, tenant_id: uuid.UUID) -> Optional[Any]:
        """Get a record by ID with tenant isolation."""
        return db_session.query(cls).filter(cls.id == id, cls.tenant_id == tenant_id).first()
    
    @classmethod
    def get_all(cls, db_session, tenant_id: uuid.UUID, skip: int = 0, limit: int = 100) -> list[Any]:
        """Get all records with tenant isolation."""
        return db_session.query(cls).filter(cls.tenant_id == tenant_id).offset(skip).limit(limit).all()
    
    @classmethod
    def create(cls, db_session, tenant_id: uuid.UUID, **kwargs) -> Any:
        """Create a new record with tenant isolation."""
        obj = cls(tenant_id=tenant_id, **kwargs)
        db_session.add(obj)
        db_session.commit()
        db_session.refresh(obj)
        return obj
    
    @classmethod
    def update(cls, db_session, id: uuid.UUID, tenant_id: uuid.UUID, **kwargs) -> Optional[Any]:
        """Update a record with tenant isolation."""
        obj = cls.get_by_id(db_session, id, tenant_id)
        if obj:
            for key, value in kwargs.items():
                setattr(obj, key, value)
            db_session.commit()
            db_session.refresh(obj)
        return obj
    
    @classmethod
    def delete(cls, db_session, id: uuid.UUID, tenant_id: uuid.UUID) -> bool:
        """Delete a record with tenant isolation."""
        obj = cls.get_by_id(db_session, id, tenant_id)
        if obj:
            db_session.delete(obj)
            db_session.commit()
            return True
        return False