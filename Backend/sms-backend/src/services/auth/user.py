from typing import List, Optional, Dict, Any
from uuid import UUID

from src.db.crud import user as user_crud
from src.db.models.auth import User
from src.schemas.auth import UserCreate, UserUpdate
from src.services.base.base import TenantBaseService, SuperAdminBaseService
from src.utils.uuid_utils import ensure_uuid


class UserService(TenantBaseService[User, UserCreate, UserUpdate]):
    """
    Service for managing users within a tenant.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(crud=user_crud, model=User, *args, **kwargs)
    
    def get_by_email(self, email: str) -> Optional[User]:
        """Get a user by email within the current tenant."""
        return user_crud.get_by_email(self.db, tenant_id=self.tenant_id, email=email)
    
    def authenticate(self, email: str, password: str) -> Optional[User]:
        """Authenticate a user by email and password."""
        return user_crud.authenticate(self.db, tenant_id=self.tenant_id, email=email, password=password)
    
    def get_active_users(self, skip: int = 0, limit: int = 100) -> List[User]:
        """Get all active users within the current tenant."""
        return user_crud.get_active_users(self.db, tenant_id=self.tenant_id, skip=skip, limit=limit)


class SuperAdminUserService(SuperAdminBaseService[User, UserCreate, UserUpdate]):
    """
    Super-admin service for managing users across all tenants.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(crud=user_crud, model=User, *args, **kwargs)
    
    def get_all_users(self, skip: int = 0, limit: int = 100, 
                email: Optional[str] = None,
                is_active: Optional[bool] = None,
                tenant_id: Optional[UUID] = None,
                sort_by: str = "email",
                sort_order: str = "asc") -> List[User]:
        """Get all users across all tenants with filtering and sorting."""
        query = self.db.query(User)
        
        # Apply filters
        if email:
            query = query.filter(User.email.ilike(f"%{email}%"))
        if is_active is not None:
            query = query.filter(User.is_active == is_active)
        if tenant_id:
            tenant_id_uuid = ensure_uuid(tenant_id)
            query = query.filter(User.tenant_id == tenant_id_uuid)
        
        # Apply sorting
        if hasattr(User, sort_by):
            sort_field = getattr(User, sort_by)
            if sort_order.lower() == "desc":
                query = query.order_by(sort_field.desc())
            else:
                query = query.order_by(sort_field.asc())
        
        return query.offset(skip).limit(limit).all()