from typing import List, Optional, Dict, Any, Union
from uuid import UUID
from datetime import datetime

from src.db.crud.communication import announcement_crud
from src.db.models.communication.announcement import Announcement, AnnouncementTargetType
from src.schemas.communication.announcement import AnnouncementCreate, AnnouncementUpdate, AnnouncementWithDetails
from src.services.base.base import TenantBaseService, SuperAdminBaseService
# from src.core.exceptions.business import EntityNotFoundError


class AnnouncementService(TenantBaseService[Announcement, AnnouncementCreate, AnnouncementUpdate]):
    """Service for managing announcements within a tenant."""
    
    def __init__(self, *args, **kwargs):
        super().__init__(crud=announcement_crud, model=Announcement, *args, **kwargs)
    
    def get_active_announcements(self) -> List[Announcement]:
        """Get all active announcements."""
        return announcement_crud.get_active_announcements(
            self.db, tenant_id=self.tenant_id
        )
    
    def get_pinned_announcements(self) -> List[Announcement]:
        """Get all pinned announcements."""
        return announcement_crud.get_pinned_announcements(
            self.db, tenant_id=self.tenant_id
        )
    
    def get_announcements_by_author(self, author_id: UUID) -> List[Announcement]:
        """Get all announcements by a specific author."""
        return announcement_crud.get_announcements_by_author(
            self.db, tenant_id=self.tenant_id, author_id=author_id
        )
    
    def get_announcements_by_target_type(self, target_type: str) -> List[Announcement]:
        """Get all announcements for a specific target type."""
        try:
            target_enum = AnnouncementTargetType(target_type)
            return announcement_crud.get_announcements_by_target_type(
                self.db, tenant_id=self.tenant_id, target_type=target_enum
            )
        except ValueError:
            raise ValueError(f"Invalid target type: {target_type}")
    
    def get_announcements_by_target(self, target_type: str, target_id: UUID) -> List[Announcement]:
        """Get all announcements for a specific target."""
        try:
            target_enum = AnnouncementTargetType(target_type)
            return announcement_crud.get_announcements_by_target(
                self.db, tenant_id=self.tenant_id, target_type=target_enum, target_id=target_id
            )
        except ValueError:
            raise ValueError(f"Invalid target type: {target_type}")
    
    def get_announcement_with_details(self, id: UUID) -> Optional[AnnouncementWithDetails]:
        """Get an announcement with additional details like author name and target name."""
        announcement = self.get(id=id)
        if not announcement:
            return None
        
        # Get author name
        author = self.db.query("User").filter("User.id" == announcement.author_id).first()
        author_name = f"{author.first_name} {author.last_name}" if author else "Unknown"
        
        # Get target name if applicable
        target_name = None
        if announcement.target_id and announcement.target_type in [AnnouncementTargetType.GRADE, AnnouncementTargetType.SECTION]:
            if announcement.target_type == AnnouncementTargetType.GRADE:
                target = self.db.query("Grade").filter("Grade.id" == announcement.target_id).first()
                target_name = target.name if target else "Unknown Grade"
            elif announcement.target_type == AnnouncementTargetType.SECTION:
                target = self.db.query("Section").filter("Section.id" == announcement.target_id).first()
                target_name = target.name if target else "Unknown Section"
        
        # Create AnnouncementWithDetails
        announcement_dict = announcement.__dict__.copy()
        announcement_dict["author_name"] = author_name
        announcement_dict["target_name"] = target_name
        
        return AnnouncementWithDetails(**announcement_dict)


class SuperAdminAnnouncementService(SuperAdminBaseService[Announcement, AnnouncementCreate, AnnouncementUpdate]):
    """Super-admin service for managing announcements across all tenants."""
    
    def __init__(self, *args, **kwargs):
        super().__init__(crud=announcement_crud, model=Announcement, *args, **kwargs)
    
    def get_all_announcements(self, skip: int = 0, limit: int = 100,
                            author_id: Optional[UUID] = None,
                            target_type: Optional[str] = None,
                            is_active: Optional[bool] = None,
                            is_pinned: Optional[bool] = None,
                            tenant_id: Optional[UUID] = None) -> List[Announcement]:
        """Get all announcements across all tenants with filtering."""
        query = self.db.query(Announcement)
        
        # Apply filters
        if author_id:
            query = query.filter(Announcement.author_id == author_id)
        if target_type:
            try:
                target_enum = AnnouncementTargetType(target_type)
                query = query.filter(Announcement.target_type == target_enum)
            except ValueError:
                raise ValueError(f"Invalid target type: {target_type}")
        if is_active is not None:
            query = query.filter(Announcement.is_active == is_active)
        if is_pinned is not None:
            query = query.filter(Announcement.is_pinned == is_pinned)
        if tenant_id:
            query = query.filter(Announcement.tenant_id == tenant_id)
        
        # Apply pagination and ordering
        return query.order_by(Announcement.publish_date.desc()).offset(skip).limit(limit).all()

        