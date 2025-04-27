from sqlalchemy import Boolean, Column, String, ForeignKey
from sqlalchemy.orm import relationship

from src.db.base import Base, UUIDMixin, TimestampMixin, TenantMixin


class User(Base, UUIDMixin, TimestampMixin, TenantMixin):
    __tablename__ = "user"

    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)

    # Relationships
    tenant_id = Column(String, ForeignKey("tenant.id"), nullable=False)
    tenant = relationship("Tenant", back_populates="users")

    def __repr__(self) -> str:
        return f"<User {self.email}>"