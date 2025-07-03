from typing import Any, Dict, List, Optional, Union
from sqlalchemy.orm import Session

from src.db.crud.base import CRUDBase
from src.db.models.auth import Permission
from src.schemas.auth.permission import PermissionCreate, PermissionUpdate


class CRUDPermission(CRUDBase[Permission, PermissionCreate, PermissionUpdate]):
    """CRUD operations for Permission model."""
    
    def get_by_name(self, db: Session, name: str) -> Optional[Permission]:
        """Get a permission by name."""
        return db.query(Permission).filter(Permission.name == name).first()
    
    def get_multi_by_names(self, db: Session, names: List[str]) -> List[Permission]:
        """Get multiple permissions by their names."""
        return db.query(Permission).filter(Permission.name.in_(names)).all()


permission = CRUDPermission(Permission)

