from sqlalchemy import Column, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID

from src.db.models.base import TenantModel


class StoredFile(TenantModel):
    """An uploaded file. The bytes live in the FileStorage (services/files) under storage_key;
    this row holds what the app needs to serve and check them."""

    __tablename__ = "files"

    storage_key = Column(String(255), nullable=False)
    filename = Column(String(255), nullable=False)
    content_type = Column(String(100), nullable=False)
    size_bytes = Column(Integer, nullable=False)
    sha256 = Column(String(64), nullable=False)
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    __table_args__ = (
        UniqueConstraint("storage_key", name="uq_files_storage_key"),
    )
