from typing import Any, List, Optional
from uuid import UUID
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, status, Request, Body
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from pydantic import BaseModel

from src.db.crud import user as user_crud
from src.db.crud import permission as permission_crud
from src.db.crud import user_role as user_role_crud
from src.db.session import get_db
from src.schemas.auth import User, UserCreate, UserUpdate, UserWithRoles, UserWithRole
from src.schemas.auth import Permission, PermissionCreate, PermissionUpdate
from src.schemas.auth import UserRole, UserRoleCreate, UserRoleUpdate
from src.schemas.auth.token import Token
from src.core.config import settings
from src.core.security.jwt import create_access_token, create_refresh_token, verify_token
from src.core.security.permissions import has_role, has_any_role, has_permission, admin_with_tenant_check
from src.core.middleware.tenant import get_tenant_id_from_request, get_optional_tenant_id_from_request
from src.core.security.auth import get_current_active_user, get_current_user
from src.core.security.password import verify_password, get_password_hash
from src.services.notification.email_service import EmailService
from src.services.auth.password_policy import PasswordPolicy
from src.services.auth.password_strength import calculate_password_strength
from src.services.auth.password import generate_default_password
from src.services.logging import AuditLoggingService

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

# Replace all instances of 'tenant_id: UUID,' with 'tenant_id: UUID = Depends(get_tenant_id_from_request),'

@router.get("/users", response_model=List[User])
def get_users(*, db: Session = Depends(get_db), tenant_id: UUID = Depends(get_tenant_id_from_request), skip: int = 0, limit: int = 100) -> Any:
    """Get all users for a tenant."""
    return user_crud.list(db, tenant_id=tenant_id, skip=skip, limit=limit)

@router.get("/users/active", response_model=List[User])
def get_active_users(*, db: Session = Depends(get_db), tenant_id: UUID = Depends(get_tenant_id_from_request), skip: int = 0, limit: int = 100) -> Any:
    """Get all active users for a tenant."""
    return user_crud.get_active_users(db, tenant_id=tenant_id, skip=skip, limit=limit)

@router.get("/users/{user_id}", response_model=User)
def get_user(*, db: Session = Depends(get_db), tenant_id: UUID = Depends(get_tenant_id_from_request), user_id: UUID) -> Any:
    """Get a specific user by ID."""
    user = user_crud.get_by_id(db, tenant_id=tenant_id, id=user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return user

# Add this import at the top
from src.services.logging import AuditLoggingService

# Update the update_user function
@router.put("/users/{user_id}", response_model=User)
def update_user(*, db: Session = Depends(get_db), tenant_id: UUID = Depends(get_tenant_id_from_request), user_id: UUID, user_in: UserUpdate, current_user: User = Depends(get_current_user)) -> Any:
    """Update a user."""
    
    # Check if current user is super admin updating their own profile
    is_super_admin = any(role.name == "superadmin" for role in current_user.roles)
    is_self_update = current_user.id == user_id
    
    if is_super_admin and is_self_update:
        # For super admin self-updates, use global lookup to bypass tenant restrictions
        user = user_crud.get_by_id_global(db, id=user_id)
    else:
        # Regular tenant-scoped lookup for all other cases
        user = user_crud.get_by_id(db, tenant_id=tenant_id, id=user_id)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Store old values for audit
    old_values = {
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "is_active": user.is_active
    }
    
    # For super admin self-updates, use the user's actual tenant_id for the update
    update_tenant_id = user.tenant_id if (is_super_admin and is_self_update) else tenant_id
    
    updated_user = user_crud.update(db, tenant_id=update_tenant_id, db_obj=user, obj_in=user_in)
    
    # Log the activity
    try:
        audit_service = AuditLoggingService(db=db, tenant_id=update_tenant_id)
        audit_service.log_activity(
            user_id=current_user.id,
            action="update",
            entity_type="user",
            entity_id=user_id,
            old_values=old_values,
            new_values=user_in.model_dump(exclude_unset=True)
        )
    except Exception as e:
        print(f"Error logging user update activity: {e}")
    
    return updated_user

# Update the delete_user function
@router.delete("/users/{user_id}", response_model=User)
def delete_user(*, db: Session = Depends(get_db), tenant_id: UUID = Depends(get_tenant_id_from_request), user_id: UUID, current_user: User = Depends(get_current_user)) -> Any:
    """Delete a user."""
    user = user_crud.get_by_id(db, tenant_id=tenant_id, id=user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Store user data for audit before deletion
    user_data = {
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "is_active": user.is_active
    }
    
    deleted_user = user_crud.delete(db, tenant_id=tenant_id, id=user_id)
    
    # Log the activity
    try:
        audit_service = AuditLoggingService(db=db, tenant_id=tenant_id)
        audit_service.log_activity(
            user_id=current_user.id,
            action="delete",
            entity_type="user",
            entity_id=user_id,
            old_values=user_data,
            new_values=None
        )
    except Exception as e:
        print(f"Error logging user deletion activity: {e}")
    
    return deleted_user

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


@router.post("/login", response_model=Token)
def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_optional_tenant_id_from_request)
) -> Any:
    """OAuth2 compatible token login, get an access token for future requests."""
    # tenant_id is now injected properly by FastAPI
    # CRITICAL FIX: Handle None tenant_id properly
    if tenant_id is None or str(tenant_id).lower() in ['none', 'null', 'undefined']:
        user = user_crud.authenticate_global(db, email=form_data.username, password=form_data.password)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        tenant_id = user.tenant_id
    else:
        user = user_crud.authenticate(db, tenant_id=tenant_id, email=form_data.username, password=form_data.password)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    final_tenant_id = tenant_id if tenant_id is not None else user.tenant_id
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        subject=user.id,
        tenant_id=final_tenant_id,
        is_super_admin=getattr(user, "is_super_admin", False),
        expires_delta=access_token_expires
    )
    # Fix the create_refresh_token call around line 291
    refresh_token = create_refresh_token(
        subject=str(user.id),
        tenant_id=str(final_tenant_id),
        is_super_admin=getattr(user, "is_super_admin", False)
    )
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }

@router.post("/refresh", response_model=Token)
def refresh_access_token(
    refresh_token: str = Body(..., embed=True),
    db: Session = Depends(get_db)
) -> Any:
    """Refresh access token using refresh token."""
    try:
        # Verify refresh token
        token_data = verify_token(refresh_token)
        if not token_data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )
        
        # Get user
        user = user_crud.get_by_id_global(db, id=UUID(token_data.sub))
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or inactive"
            )
        
        # CRITICAL FIX: Handle tenant_id properly from token
        token_tenant_id = token_data.tenant_id
        if token_tenant_id is None or str(token_tenant_id).lower() in ['none', 'null', 'undefined']:
            # Use the user's actual tenant_id from database
            final_tenant_id = user.tenant_id
        else:
            final_tenant_id = token_tenant_id
        
        # Create new tokens with proper tenant_id
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        new_access_token = create_access_token(
            subject=str(user.id),
            tenant_id=str(final_tenant_id),
            expires_delta=access_token_expires
        )
        new_refresh_token = create_refresh_token(
            subject=str(user.id),
            tenant_id=str(final_tenant_id),
            is_super_admin=getattr(user, "is_super_admin", False)
        )
        
        return {
            "access_token": new_access_token,
            "refresh_token": new_refresh_token,
            "token_type": "bearer",
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )


@router.get("/me", response_model=UserWithRole)
async def read_users_me(current_user: User = Depends(get_current_active_user)):
    """Get current user profile."""
    user_dict = current_user.__dict__.copy()
    
    # Add role_name field
    if hasattr(current_user, "roles") and current_user.roles:
        user_dict["role"] = current_user.roles[0].name
    else:
        user_dict["role"] = None
    
    # The tenant_id comes directly from the database user record
    # No hardcoding needed - it's already in current_user.tenant_id
    
    return user_dict

@router.get("/admin-dashboard")
async def admin_dashboard(current_user: User = Depends(has_any_role(["admin", "superadmin"]))):
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


# Add these endpoints to your existing auth.py

@router.post("/users/{user_id}/roles")
def assign_roles_to_user(
    user_id: UUID,
    role_ids: List[UUID],
    db: Session = Depends(get_db),
    current_user: User = Depends(has_permission("manage_users"))
):
    """Assign multiple roles to a user."""
    # Implementation here

@router.delete("/users/{user_id}/roles/{role_id}")
def remove_role_from_user(
    user_id: UUID,
    role_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(has_permission("manage_users"))
):
    """Remove a role from a user."""
    # Implementation here

@router.get("/roles/{role_id}/users")
def get_users_with_role(
    role_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(has_permission("view_users"))
):
    """Get all users with a specific role."""
    # Implementation here

@router.post("/logout")
async def logout(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> Any:
    """Logout the current user by blacklisting their token."""
    try:
        # Verify the token to get its payload
        token_data = verify_token(token)
        
        if token_data and hasattr(token_data, 'exp'):
            # Token is valid - proceed with proper blacklisting
            blacklist_service = TokenBlacklistService()
            
            # Blacklist the token so it can't be used again
            blacklist_service.blacklist_token(token, token_data.exp)
            
            return {
                "message": "Successfully logged out",
                "status": "success"
            }
        else:
            # Token is invalid/expired but still return success
            # This handles edge cases gracefully
            return {
                "message": "Successfully logged out", 
                "status": "success"
            }
            
    except Exception as e:
        # Log error for debugging but don't fail the logout
        print(f"Logout warning: {e}")
        return {
            "message": "Successfully logged out",
            "status": "success"
        }