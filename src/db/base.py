import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import Column, DateTime, String
from sqlalchemy.ext.declarative import as_declarative, declared_attr
from sqlalchemy.orm import Session

from src.core.config import settings


@as_declarative()
class Base:
    id: Any
    __name__: str

    # Generate __tablename__ automatically
    @declared_attr
    def __tablename__(cls) -> str:
        return cls.__name__.lower()


class UUIDMixin:
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))


class TimestampMixin:
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class TenantMixin:
    tenant_id = Column(String, nullable=False)

    @classmethod
    def get_tenant_id(cls, db: Session) -> str:
        from src.core.middleware.tenant import get_current_tenant_id
        return get_current_tenant_id()