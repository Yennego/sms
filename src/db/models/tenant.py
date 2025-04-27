from sqlalchemy import Boolean, Column, String, JSON
from sqlalchemy.orm import relationship

from src.db.base import Base, UUIDMixin, TimestampMixin


class Tenant(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "tenant"

    name = Column(String, nullable=False)
    slug = Column(String, unique=True, index=True, nullable=False)
    domain = Column(String, unique=True, index=True)
    is_active = Column(Boolean, default=True)
    settings = Column(JSON, default={})

    # Relationships
    users = relationship("User", back_populates="tenant")

    def __repr__(self) -> str:
        return f"<Tenant {self.name}>"