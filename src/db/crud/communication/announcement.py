from typing import List, Optional, Dict, Any
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import desc

from src.db.crud.base.base import TenantCRUDBase
from src.db.models.communication.announcement import Announcement, AnnouncementTargetType
from src.schemas.communication.announcement import AnnouncementCreate, AnnouncementUpdate


class CRUDAnnouncement(TenantCRUDBase[Announcement, AnnouncementCreate, AnnouncementUpdate]):
    """CRUD operations for Announcement model."""
    
    def get_active_announcements(self, db: Session, tenant_id: Any) -> List[Announcement]:
        """Get all active announcements within a tenant."""
        return db.query(Announcement).filter(
            Announcement.tenant_id == tenant_id,
            Announcement.is_active == True
        ).order_by(desc(Announcement.publish_date)).all()
    
    def get_pinned_announcements(self, db: Session, tenant_id: Any) -> List[Announcement]:
        """Get all pinned announcements within a tenant."""
        return db.query(Announcement).filter(
            Announcement.tenant_id == tenant_id,
            Announcement.is_active == True,
            Announcement.is_pinned == True
        ).order_by(desc(Announcement.publish_date)).all()
    
    def get_announcements_by_author(self, db: Session, tenant_id: Any, author_id: Any) -> List[Announcement]:
        """Get all announcements by a specific author within a tenant."""
        return db.query(Announcement).filter(
            Announcement.tenant_id == tenant_id,
            Announcement.author_id == author_id
        ).order_by(desc(Announcement.publish_date)).all()
    
    def get_announcements_by_target_type(self, db: Session, tenant_id: Any, target_type: AnnouncementTargetType) -> List[Announcement]:
        """Get all announcements for a specific target type within a tenant."""
        return db.query(Announcement).filter(
            Announcement.tenant_id == tenant_id,
            Announcement.target_type == target_type
        ).order_by(desc(Announcement.publish_date)).all()
    
    def get_announcements_by_target(self, db: Session, tenant_id: Any, target_type: AnnouncementTargetType, target_id: Any) -> List[Announcement]:
        """Get all announcements for a specific target within a tenant."""
        return db.query(Announcement).filter(
            Announcement.tenant_id == tenant_id,
            Announcement.target_type == target_type,
            Announcement.target_id == target_id
        ).order_by(desc(Announcement.publish_date)).all()


announcement_crud = CRUDAnnouncement(Announcement)