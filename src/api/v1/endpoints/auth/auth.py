from typing import Any, List, Optional
from uuid import UUID
from datetime import datetime, timezone, timedelta

# Add this endpoint
# from fastapi import Depends, HTTPException, status, Request
# from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status, Request, Body
from sqlalchemy.orm import Session

from src.db.crud import user as user_crud
from src.db.crud import permission as permission_crud
from src.db.crud import user_role as user_role_crud
from src.db.session import get_db
from src.schemas.auth import User, UserCreate, UserUpdate
from src.schemas.auth import Permission, PermissionCreate, PermissionUpdate
from src.schemas.auth import UserRole, UserRoleCreate, UserRoleUpdate
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from src.core.security.jwt import create_access_token, create_refresh_token, verify_token
# Update these imports
from src.core.security.permissions import has_role, has_any_role, has_permission, admin_with_tenant_check
from src.schemas.auth.token import Token
from src.core.auth.dependencies import get_tenant_id_from_request
from src.core.security.auth import get_current_active_user, get_current_user  # Import directly from auth.py
from pydantic import BaseModel
from src.services.notification.email_service import EmailService
from src.services.auth.password_policy import PasswordPolicy
from src.services.auth.password_strength import calculate_password_strength

# Define the oauth2_scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

router = APIRouter()

# User endpoints
class UserCreateResponse(User):
    generated_password: Optional[str] = None

# In the create_user function
@router.post("/users", response_model=UserCreateResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    *, 
    db: Session = Depends(get_db), 
    tenant_id: UUID = Depends(get_tenant_id_from_request),
    user_in: UserCreate,
    current_user: User = Depends(has_permission("create_users"))
) -> Any:
    """Create a new user (requires create_users permission)."""
    user = user_crud.get_by_email(db, tenant_id=tenant_id, email=user_in.email)
    if user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists"
        )
    new_user = user_crud.create(db, tenant_id=tenant_id, obj_in=user_in)
    
    # Send email notification if a password was generated
    if hasattr(new_user, 'generated_password'):
        email_service = EmailService()
        email_service.send_password_notification(
            new_user.email, 
            new_user.generated_password
        )
    
    # Create response with the generated password if it exists
    response = UserCreateResponse.model_validate(new_user, from_attributes=True)
    if hasattr(new_user, 'generated_password'):
        response.generated_password = new_user.generated_password
    
    return response

@router.get("/users", response_model=List[User])
def get_users(*, db: Session = Depends(get_db), tenant_id: UUID, skip: int = 0, limit: int = 100) -> Any:
    """Get all users for a tenant."""
    return user_crud.list(db, tenant_id=tenant_id, skip=skip, limit=limit)

@router.get("/users/active", response_model=List[User])
def get_active_users(*, db: Session = Depends(get_db), tenant_id: UUID, skip: int = 0, limit: int = 100) -> Any:
    """Get all active users for a tenant."""
    return user_crud.get_active_users(db, tenant_id=tenant_id, skip=skip, limit=limit)

@router.get("/users/{user_id}", response_model=User)
def get_user(*, db: Session = Depends(get_db), tenant_id: UUID, user_id: UUID) -> Any:
    """Get a specific user by ID."""
    user = user_crud.get_by_id(db, tenant_id=tenant_id, id=user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return user

@router.put("/users/{user_id}", response_model=User)
def update_user(*, db: Session = Depends(get_db), tenant_id: UUID, user_id: UUID, user_in: UserUpdate) -> Any:
    """Update a user."""
    user = user_crud.get_by_id(db, tenant_id=tenant_id, id=user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return user_crud.update(db, tenant_id=tenant_id, db_obj=user, obj_in=user_in)

@router.delete("/users/{user_id}", response_model=User)
def delete_user(*, db: Session = Depends(get_db), tenant_id: UUID, user_id: UUID) -> Any:
    """Delete a user."""
    user = user_crud.get_by_id(db, tenant_id=tenant_id, id=user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return user_crud.delete(db, tenant_id=tenant_id, id=user_id)

# Permission endpoints
@router.post("/permissions", response_model=Permission, status_code=status.HTTP_201_CREATED)
def create_permission(*, db: Session = Depends(get_db), permission_in: PermissionCreate) -> Any:
    """Create a new permission."""
    permission = permission_crud.get_by_name(db, name=permission_in.name)
    if permission:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Permission with this name already exists"
        )
    return permission_crud.create(db, obj_in=permission_in)

@router.get("/permissions", response_model=List[Permission])
def get_permissions(*, db: Session = Depends(get_db), skip: int = 0, limit: int = 100) -> Any:
    """Get all permissions."""
    return permission_crud.get_multi(db, skip=skip, limit=limit)

# UserRole endpoints
@router.post("/roles", response_model=UserRole, status_code=status.HTTP_201_CREATED)
def create_role(*, db: Session = Depends(get_db), role_in: UserRoleCreate) -> Any:
    """Create a new user role."""
    role = user_role_crud.get_by_name(db, name=role_in.name)
    if role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role with this name already exists"
        )
    return user_role_crud.create(db, obj_in=role_in)

@router.get("/roles", response_model=List[UserRole])
def get_roles(*, db: Session = Depends(get_db), skip: int = 0, limit: int = 100) -> Any:
    """Get all user roles."""
    return user_role_crud.get_multi(db, skip=skip, limit=limit)


# Simple in-memory rate limiter (replace with Redis in production)
login_attempts = {}

def rate_limit_login(request: Request):
    ip = request.client.host
    current_time = datetime.now(timezone.utc)
    
    # Clean up old entries
    for key in list(login_attempts.keys()):
        if login_attempts[key]["reset_time"] < current_time:
            del login_attempts[key]
    
    # Check if IP is in the dictionary
    if ip not in login_attempts:
        login_attempts[ip] = {
            "count": 1,
            "reset_time": current_time + timedelta(minutes=15)
        }
        return
    
    # Increment count
    login_attempts[ip]["count"] += 1
    
    # Check if limit exceeded
    if login_attempts[ip]["count"] > 5:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please try again later."
        )

# Update login endpoint
@router.post("/login", response_model=Token)
def login(
    request: Request,  # Add this
    db: Session = Depends(get_db),
    form_data: OAuth2PasswordRequestForm = Depends(),
    tenant_id: UUID = Depends(get_tenant_id_from_request),
    _: None = Depends(rate_limit_login)  # Add this
) -> Any:
    """OAuth2 compatible token login, get an access token for future requests."""
    try:
        user = user_crud.authenticate(
            db, tenant_id=tenant_id, email=form_data.username, password=form_data.password
        )
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail="Inactive user"
            )
        
        # Update last login timestamp
        user.last_login = datetime.now(timezone.utc)
        
        # Check if it's the first login
        requires_password_change = user.is_first_login
        
        db.add(user)
        db.commit()
        
        # In the login function
        # Check if password is expired
        password_expired = False
        if user.password_expiry_date and user.password_expiry_date < datetime.now(timezone.utc):
            password_expired = True
        
        # Add to response
        return {
            "access_token": create_access_token(user.id, tenant_id),
            "refresh_token": create_refresh_token(user.id, tenant_id),
            "token_type": "bearer",
            "requires_password_change": requires_password_change or password_expired
        }
    except Exception as e:
        # Log the error for debugging
        print(f"Login error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred during login: {str(e)}"
        )

@router.post("/refresh", response_model=Token)
def refresh_token(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
) -> Any:
    """Refresh access token."""
    token_data = verify_token(token)
    if not token_data or token_data.type != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user = user_crud.get_by_id(db, tenant_id=token_data.tenant_id, id=token_data.sub)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token for user",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return {
        "access_token": create_access_token(user.id, token_data.tenant_id),
        "refresh_token": create_refresh_token(user.id, token_data.tenant_id),
        "token_type": "bearer",
    }

@router.get("/me", response_model=User)
async def read_users_me(current_user: User = Depends(get_current_active_user)):
    """Get current user profile."""
    # Add logic here to tailor the response based on current_user.roles if needed
    # For now, it returns the full user object, ensure this is intended for all roles.
    # If super-admin should see more, or other roles less, adjust the response.
    return current_user

@router.get("/admin-dashboard")
async def admin_dashboard(current_user: User = Depends(has_any_role(["admin", "super-admin"]))):
    """Admin dashboard - accessible by admin and super-admin roles."""
    return {"message": "Welcome to the admin dashboard", "user": current_user.email}


class PasswordChange(BaseModel):
    current_password: str
    new_password: str

@router.post("/change-password")
def change_password(
    password_data: PasswordChange,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
) -> Any:
    """Change user password and clear first login flag."""
    # Verify current password
    if not verify_password(password_data.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect password"
        )
    
    # Validate new password against policy
    password_policy = PasswordPolicy()
    validation_errors = password_policy.validate(password_data.new_password)
    
    if validation_errors:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"errors": validation_errors}
        )
    
    # Update password and clear first login flag
    current_user.password_hash = get_password_hash(password_data.new_password)
    current_user.is_first_login = False
    
    db.add(current_user)
    db.commit()
    
    # In the change_password function
    # Calculate password strength
    strength = calculate_password_strength(password_data.new_password)
    
    return {
        "message": "Password changed successfully",
        "password_strength": strength
    }


class AdminPasswordReset(BaseModel):
    user_id: UUID

@router.post("/admin/reset-password/{user_id}")
def admin_reset_password(
    user_id: UUID,
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id_from_request),
    current_user: User = Depends(admin_with_tenant_check())
) -> Any:
    """Reset a user's password (admin only)"""
    user = user_crud.get_by_id(db, tenant_id=tenant_id, id=user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Generate new password
    new_password = generate_default_password()
    
    # Update user
    user.password_hash = get_password_hash(new_password)
    user.is_first_login = True
    
    db.add(user)
    db.commit()
    
    # Send email notification
    email_service = EmailService()
    email_service.send_password_notification(user.email, new_password)
    
    return {"message": "Password reset successful", "generated_password": new_password}

@router.post("/roles/{role_id}/permissions", response_model=UserRole)
def add_permissions_to_role(
    *,
    db: Session = Depends(get_db),
    role_id: UUID,
    permission_names: List[str] = Body(..., description="List of permission names to add to the role"),
    current_user: User = Depends(has_permission("manage_roles"))
) -> Any:
    """Add permissions to a role."""
    # Check if role exists
    role = user_role_crud.get(db, id=role_id)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )
    
    # Get permissions by names
    permissions = permission_crud.get_multi_by_names(db, names=permission_names)
    permission_ids = [perm.id for perm in permissions]
    
    # Check if all requested permissions exist
    if len(permission_ids) != len(permission_names):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more permissions not found"
        )
    
    # Add permissions to role
    return user_role_crud.add_permissions_to_role(db, role_id=role_id, permission_ids=permission_ids)


@router.get("/roles/{role_id}/permissions", response_model=List[Permission])
def get_role_permissions(
    *,
    db: Session = Depends(get_db),
    role_id: UUID,
    current_user: User = Depends(has_permission("manage_roles"))
) -> Any:
    """Get permissions assigned to a role."""
    # Check if role exists
    role = user_role_crud.get(db, id=role_id)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )
    
    # Return the permissions associated with the role
    return role.permissions


@router.get("/test-endpoint")
def test_endpoint():
    return {"message": "Auth router is working"}