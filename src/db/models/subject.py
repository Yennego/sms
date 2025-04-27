import uuid
from sqlalchemy import Column, String, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from src.db.models.base import TimestampMixin, UUIDMixin, TenantMixin

class Subject(UUIDMixin, TimestampMixin, TenantMixin):
    __tablename__ = "subjects"
    name = Column(String(255), nullable=False)
    code = Column(String(50), nullable=False, unique=True)
    description = Column(Text, nullable=True) 