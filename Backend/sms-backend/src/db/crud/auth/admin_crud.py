from typing import Any, Dict, List, Optional, Union
from uuid import UUID
from sqlalchemy.orm import Session

from src.db.crud.base import CRUDBase
from src.db.models.auth.admin import Admin
from src.schemas.auth.admin import AdminCreate, AdminUpdate


class CRUDAdmin(CRUDBase[Admin, AdminCreate, AdminUpdate]):
    """CRUD operations for Admin model."""
    
    def get_by_email(self, db: Session, email: str) -> Optional[Admin]:
        """Get an admin by email."""
        return db.query(Admin).filter(Admin.email == email).first()
    
    def get_by_department(self, db: Session, department: str) -> List[Admin]:
        """Get admins by department."""
        return db.query(Admin).filter(Admin.department == department).all()
    
    def get_by_admin_level(self, db: Session, admin_level: str) -> List[Admin]:
        """Get admins by admin level."""
        return db.query(Admin).filter(Admin.admin_level == admin_level).all()
    
    def get_active_admins(self, db: Session) -> List[Admin]:
        """Get all active admins."""
        return db.query(Admin).filter(Admin.is_active == True).all()


admin_crud = CRUDAdmin(Admin)

