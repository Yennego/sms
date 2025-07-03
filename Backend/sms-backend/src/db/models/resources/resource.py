from sqlalchemy import Column, String, ForeignKey, Text, Integer, DateTime, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import enum

from src.db.models.base import TenantModel


class ResourceType(enum.Enum):
    """Enum for resource types."""
    DOCUMENT = "document"  # Documents (PDF, DOC, etc.)
    VIDEO = "video"  # Video files
    AUDIO = "audio"  # Audio files
    IMAGE = "image"  # Image files
    LINK = "link"  # External links
    OTHER = "other"  # Other resource types


class Resource(TenantModel):
    """Model representing an educational resource in the system.
    
    This model tracks educational resources, including details about the resource,
    its type, location, and the user who uploaded it.
    
    Attributes:
        title (String): Title of the resource
        description (Text): Description of the resource
        resource_type (Enum): Type of resource (document, video, audio, etc.)
        file_path (String): Path to the resource file
        file_size (Integer): Size of the resource file in bytes
        file_extension (String): Extension of the resource file
        external_url (String): URL for external resources
        uploader_id (UUID): Foreign key to the user who uploaded the resource
        subject_id (UUID): Foreign key to the subject the resource is related to
        grade_id (UUID): Foreign key to the grade the resource is related to
        is_public (Boolean): Whether the resource is public
        upload_date (DateTime): Date when the resource was uploaded
        last_accessed (DateTime): Date when the resource was last accessed
        access_count (Integer): Number of times the resource has been accessed
    """
    
    __tablename__ = "resources"
    
    # Resource details
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    resource_type = Column(Enum(ResourceType), nullable=False)
    
    # File details
    file_path = Column(String(255), nullable=True)  # Nullable for external resources
    file_size = Column(Integer, nullable=True)  # Size in bytes
    file_extension = Column(String(10), nullable=True)
    external_url = Column(String(255), nullable=True)  # Nullable for uploaded files
    
    # Relationships
    uploader_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    uploader = relationship("User")
    
    subject_id = Column(UUID(as_uuid=True), ForeignKey("subjects.id"), nullable=True)
    subject = relationship("Subject")
    
    grade_id = Column(UUID(as_uuid=True), ForeignKey("academic_grades.id"), nullable=True)
    grade = relationship("AcademicGrade")
    
    # Access control and statistics
    is_public = Column(String(50), nullable=False, default="private")  # private, public, restricted
    upload_date = Column(DateTime(timezone=True), nullable=False, default=func.now())
    last_accessed = Column(DateTime(timezone=True), nullable=True)
    access_count = Column(Integer, nullable=False, default=0)
    
    def __repr__(self):
        return f"<Resource {self.id} - {self.title}>"

        