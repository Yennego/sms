from typing import Any, Dict, List, Optional, Union
from sqlalchemy.orm import Session
from sqlalchemy import text  

from src.db.crud.base import TenantCRUDBase
from src.db.models.auth import User
from src.schemas.auth.user import UserCreate, UserUpdate
from src.core.security.password import get_password_hash, verify_password
from src.utils.uuid_utils import ensure_uuid
import logging

logger = logging.getLogger(__name__)


class CRUDUser(TenantCRUDBase[User, UserCreate, UserUpdate]):
    """CRUD operations for User model."""
    
    def get_by_email(self, db: Session, tenant_id: Any, email: str) -> Optional[User]:
        """Get a user by email within a tenant."""

        tenant_id = ensure_uuid(tenant_id)

        return db.query(User).filter(
            User.tenant_id == tenant_id,
            User.email == email
        ).first()
    
    def get_by_email_any_tenant(self, db: Session, email: str) -> Optional[User]:
        """Get a user by email across all tenants."""
        return db.query(User).filter(User.email == email).first()
    
    def has_role(self, db: Session, user_id: Any, role_name: str) -> bool:
        """Check if a user has a specific role."""
        # Use text() to properly declare the SQL expression
        sql = text("""SELECT 1 FROM user_role_association ura 
               JOIN user_roles ur ON ura.role_id = ur.id 
               WHERE ura.user_id = :user_id AND ur.name = :role_name""")
        
        result = db.execute(
            sql,
            {"user_id": str(user_id), "role_name": role_name}
        ).first()
        
        return result is not None
    
    def authenticate(self, db: Session, tenant_id: Any, *, email: str, password: str) -> Optional[User]:
        """Authenticate a user by email and password."""
        tenant_id_uuid = ensure_uuid(tenant_id)
        logger.debug(f"Authenticating user: email={email}, tenant_id={tenant_id}, converted={tenant_id_uuid}")
        
        # First try to find the user in the specified tenant
        user = self.get_by_email(db, tenant_id=tenant_id_uuid, email=email)
        
        # If user not found in the specified tenant, check if they exist in any tenant
        # and have the super-admin role
        if not user:
            logger.debug(f"User not found in tenant {tenant_id_uuid}, checking across all tenants")
            user_any_tenant = self.get_by_email_any_tenant(db, email=email)
            
            if user_any_tenant and self.has_role(db, user_any_tenant.id, "super-admin"):
                logger.debug(f"Found user with super-admin role in another tenant")
                user = user_any_tenant
            else:
                logger.debug(f"User not found or doesn't have super-admin role")
                return None
        
        logger.debug(f"User found, verifying password")
        if not verify_password(password, user.password_hash):
            logger.debug(f"Password verification failed for user {email}")
            return None
        
        logger.debug(f"Authentication successful for user {email}")
        return user
    
    def create(self, db: Session, tenant_id: Any, *, obj_in: UserCreate) -> User:
        """Create a new user with password hashing."""
        db_obj = User(
            email=obj_in.email,
            first_name=obj_in.first_name,
            last_name=obj_in.last_name,
            is_active=obj_in.is_active,
            phone_number=obj_in.phone_number,
            profile_picture=obj_in.profile_picture,
            preferences=obj_in.preferences,
            tenant_id=tenant_id,
            password_hash=get_password_hash(obj_in.password)  # Hash the password
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj
    
    def update(self, db: Session, tenant_id: Any, *, db_obj: User, obj_in: Union[UserUpdate, Dict[str, Any]]) -> User:
        """Update a user, handling password hashing if needed."""
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.dict(exclude_unset=True)
        
        # Hash password if it's being updated
        if update_data.get("password"):
            update_data["password_hash"] = get_password_hash(update_data["password"])
            del update_data["password"]
        
        return super().update(db, tenant_id=tenant_id, db_obj=db_obj, obj_in=update_data)
    
    def get_active_users(self, db: Session, tenant_id: Any, skip: int = 0, limit: int = 100) -> List[User]:
        """Get all active users within a tenant."""
        return db.query(User).filter(
            User.tenant_id == tenant_id,
            User.is_active == True
        ).offset(skip).limit(limit).all()


user = CRUDUser(User)