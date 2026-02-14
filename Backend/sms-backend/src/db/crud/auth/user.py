from typing import Any, Dict, List, Optional, Union
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import text, or_, func
from uuid import UUID
from typing import Optional

from src.db.crud.base import TenantCRUDBase
from src.db.models.auth import User, UserRole
from src.schemas.auth.user import UserCreate, UserUpdate
from src.core.security.password import get_password_hash, verify_password
from src.utils.uuid_utils import ensure_uuid
import logging
import secrets
import string

logger = logging.getLogger(__name__)


# Add this function to generate random passwords
def generate_default_password(length=12):
    """Generate a secure random password."""
    alphabet = string.ascii_letters + string.digits + string.punctuation
    return ''.join(secrets.choice(alphabet) for _ in range(length))

class CRUDUser(TenantCRUDBase[User, UserCreate, UserUpdate]):
    """CRUD operations for User model."""
    
    def get_by_email(self, db: Session, tenant_id: Any, email: str) -> Any:
        """Get a user by email within a tenant (case-insensitive)."""
        tenant_id = ensure_uuid(tenant_id)
        if not email:
            return None
        return db.query(User).filter(
            User.tenant_id == tenant_id,
            func.lower(User.email) == email.lower()
        ).first()
    
    def get_by_email_any_tenant(self, db: Session, email: str) -> Any:
        """Get a user by email across all tenants (case-insensitive)."""
        if not email:
            return None
        return db.query(User).filter(func.lower(User.email) == email.lower()).first()
    
    def has_role(self, db: Session, user_id: Any, role_name: str) -> bool:
        """Check if a user has a specific role."""
        # Ensure user_id is properly formatted as UUID string
        user_id_str = str(ensure_uuid(user_id))
        
        # Use text() to properly declare the SQL expression
        sql = text("""SELECT 1 FROM user_role_association ura 
               JOIN user_roles ur ON ura.role_id = ur.id 
               WHERE ura.user_id = :user_id AND ur.name = :role_name""")
        
        result = db.execute(
            sql,
            {"user_id": user_id_str, "role_name": role_name}
        ).first()
        
        return result is not None

    def authenticate_global(self, db: Session, email: str, password: str) -> Any:
        # Authenticate user globally (without tenant_id)
        user = db.query(self.model).options(joinedload(self.model.roles)).filter(self.model.email == email).first()
        if not user or not verify_password(password, user.password_hash):
            return None
        return user
    
    def authenticate(self, db: Session, tenant_id: Any, *, email: str, password: str) -> Any:
        """Authenticate a user by email and password."""
        tenant_id_uuid = ensure_uuid(tenant_id)
        logger.debug(f"[AUTH] Authenticating email={email}, tenant_id={tenant_id}, tenant_uuid={tenant_id_uuid}")
        
        # First try to find the user in the specified tenant
        user = self.get_by_email(db, tenant_id=tenant_id_uuid, email=email)
        
        if not user:
            logger.debug(f"[AUTH] User not found in tenant {tenant_id_uuid}. Checking across all tenants...")
            # If user not found in the specified tenant, check if they exist in any tenant
            # and have the super-admin role
            user_any_tenant = self.get_by_email_any_tenant(db, email=email)
            
            if user_any_tenant:
                logger.debug(f"[AUTH] Found user in tenant {user_any_tenant.tenant_id}. Checking for super-admin role...")
                if self.has_role(db, user_any_tenant.id, "super-admin"):
                    logger.debug(f"[AUTH] User is a super-admin. Proceeding.")
                    user = user_any_tenant
                else:
                    logger.debug(f"[AUTH] User found but is NOT a super-admin and NOT in requested tenant.")
            else:
                logger.debug(f"[AUTH] User not found in ANY tenant.")
                return None
        
        if not user:
            return None

        if not verify_password(password, user.password_hash):
            logger.debug(f"[AUTH] Password verification failed for user {email}")
            return None
        
        logger.debug(f"[AUTH] Authentication successful for user {email}")
        return user
    
    def create(self, db: Session, tenant_id: Any, *, obj_in: UserCreate) -> Any:
        """Create a new user with password hashing."""
        # If password is not provided or is empty, generate a default password
        password = obj_in.password
        if not password:  # This triggers for empty string!
            password = generate_default_password()
            
        db_obj = User(
            email=obj_in.email,
            first_name=obj_in.first_name,
            last_name=obj_in.last_name,
            is_active=obj_in.is_active,
            is_first_login=True, 
            phone_number=obj_in.phone_number,
            profile_picture=obj_in.profile_picture,
            preferences=obj_in.preferences,
            tenant_id=tenant_id,
            password_hash=get_password_hash(password)
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        
        # Return the generated password if it was auto-generated
        if password != obj_in.password:
            db_obj.generated_password = password
            
        return db_obj
    
    def update(self, db: Session, tenant_id: Any, *, db_obj: Any, obj_in: Union[UserUpdate, Dict[str, Any]]) -> Any:
        """Update a user, handling password hashing if needed."""
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.model_dump(exclude_unset=True)
        
        # Hash password if it's being updated
        if update_data.get("password"):
            update_data["password_hash"] = get_password_hash(update_data["password"])
            del update_data["password"]
        
        # Use SQLAlchemy's update() method to avoid triggering __init__
        if update_data:
            db.query(User).filter(User.id == db_obj.id).update(update_data)
            db.commit()
            db.refresh(db_obj)
        
        return db_obj
    
    def list_with_filters(
        self,
        db: Session,
        tenant_id: Any,
        *,
        search: Optional[str] = None,
        is_active: Optional[bool] = None,
        role_id: Optional[UUID] = None,
        sort_by: Optional[str] = "created_at",
        sort_order: str = "asc",
        skip: int = 0,
        limit: int = 100
    ) -> List[Any]:
        """List users with flexible server-side filtering."""
        tenant_id_uuid = ensure_uuid(tenant_id)

        query = db.query(User).filter(User.tenant_id == tenant_id_uuid)

        if search:
            term = f"%{search}%"
            query = query.filter(
                or_(
                    User.email.ilike(term),
                    User.first_name.ilike(term),
                    User.last_name.ilike(term),
                    User.phone_number.ilike(term)
                )
            )

        if is_active is not None:
            query = query.filter(User.is_active == is_active)

        if role_id:
            query = query.join(User.roles).filter(UserRole.id == ensure_uuid(role_id))

        sort_map = {
            "created_at": User.created_at,
            "email": User.email,
            "first_name": User.first_name,
            "last_name": User.last_name,
        }
        sort_col = sort_map.get(sort_by or "created_at", User.created_at)
        if (sort_order or "asc").lower() == "desc":
            query = query.order_by(sort_col.desc())
        else:
            query = query.order_by(sort_col.asc())

        return query.offset(skip).limit(limit).all()
    
    def get_active_users(self, db: Session, tenant_id: Any, skip: int = 0, limit: int = 100) -> List[Any]:
        """Get all active users within a tenant."""
        return db.query(User).filter(
            User.tenant_id == tenant_id,
            User.is_active == True
        ).offset(skip).limit(limit).all()

    def get_by_id_global(self, db: Session, id: UUID) -> Any:
        """Get a user by ID, without tenant filtering (for global users like super-admins)."""
        return db.query(User).filter(User.id == id).first()

    def get_by_id(self, db: Session, tenant_id: UUID, id: UUID) -> Any:
        """Get a user by ID within a specific tenant."""
        return db.query(User).filter(User.tenant_id == tenant_id, User.id == id).first()

user = CRUDUser(User)

