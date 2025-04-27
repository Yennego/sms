from typing import Any, Dict, Optional, Union, List
from uuid import UUID

from sqlalchemy.orm import Session

from src.db.crud.base import CRUDBase
from src.db.models.user import User
from src.core.exceptions import ResourceNotFoundError


class CRUDUser(CRUDBase[User, Any, Any]):
    """CRUD operations for User model with tenant isolation."""
    
    def get_by_email(self, db: Session, tenant_id: UUID, email: str) -> Optional[User]:
        """Get a user by email with tenant isolation."""
        return db.query(User).filter(
            User.email == email,
            User.tenant_id == tenant_id
        ).first()
    
    def authenticate(self, db: Session, tenant_id: UUID, email: str, password: str) -> Optional[User]:
        """Authenticate a user with tenant isolation."""
        user = self.get_by_email(db, tenant_id, email)
        if not user:
            return None
        # In a real application, you would verify the password hash here
        # For example: if not verify_password(password, user.hashed_password):
        #     return None
        return user
    
    def is_active(self, user: User) -> bool:
        """Check if user is active."""
        return user.is_active
    
    def is_superuser(self, user: User) -> bool:
        """Check if user is superuser."""
        return user.is_superuser


user = CRUDUser(User)