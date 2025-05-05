from typing import Any, List
from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
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
from src.core.security.permissions import has_role, has_any_role, has_permission, get_current_user
from src.schemas.auth.token import Token
from src.core.auth.dependencies import has_permission, get_tenant_id_from_request, get_current_active_user  # Add get_current_active_user

# Define the oauth2_scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

router = APIRouter()

# User endpoints
@router.post("/users", response_model=User, status_code=status.HTTP_201_CREATED)
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
    return user_crud.create(db, tenant_id=tenant_id, obj_in=user_in)

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

# Add this endpoint
@router.post("/login", response_model=Token)
def login(
    db: Session = Depends(get_db),
    form_data: OAuth2PasswordRequestForm = Depends(),
    tenant_id: UUID = Depends(get_tenant_id_from_request)
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
        user.last_login = datetime.utcnow()
        db.add(user)
        db.commit()
        
        return {
            "access_token": create_access_token(user.id, tenant_id),
            "refresh_token": create_refresh_token(user.id, tenant_id),
            "token_type": "bearer",
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
def read_users_me(current_user: User = Depends(get_current_active_user)):
    """Get current user profile."""
    return current_user

@router.get("/admin-dashboard")
def admin_dashboard(current_user: User = Depends(has_role("admin"))):
    """Admin dashboard (requires admin role)."""
    return {"message": "Welcome to the admin dashboard"}