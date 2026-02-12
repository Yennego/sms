# Backend\sms-backend\src\core\security\auth.py

from typing import Optional
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt
from pydantic import ValidationError
from sqlalchemy.orm import Session
from sqlalchemy.orm import joinedload

from src.core.security.jwt import verify_token
from src.db.crud.auth import user as user_crud
from src.db.session import get_db, set_tenant_id
from src.schemas.auth.token import TokenPayload
from src.db.models.auth import User


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
) -> User:
    """Get the current authenticated user from JWT token."""
    token_data = await verify_token(token)
    if not token_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    tenant_id = token_data.tenant_id
    user_id = token_data.sub

    print(f"[AUTH] Processing token - User ID: {user_id}, Tenant ID: {tenant_id}")

    # Handle super admin users (they may not have tenant context)
    if token_data.is_super_admin:
        print(f"[AUTH] Super admin user detected, allowing without tenant context")
        set_tenant_id(None)
    else:
        # Set tenant ID in context with proper validation for regular users
        if tenant_id and tenant_id != "None" and tenant_id != "null":
            try:
                tenant_id_uuid = UUID(tenant_id)
                
                # Verify tenant exists and is active
                from src.db.models.tenant import Tenant
                tenant = db.query(Tenant).filter(
                    Tenant.id == tenant_id_uuid,
                    Tenant.is_active == True
                ).first()
                
                if not tenant:
                    print(f"[AUTH] ERROR: Tenant {tenant_id_uuid} not found or inactive")
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Tenant not found or inactive: {tenant_id}"
                    )
                
                set_tenant_id(tenant_id_uuid)
                print(f"[AUTH] Successfully set tenant context: {tenant_id_uuid} - {tenant.name}")
                
            except (ValueError, TypeError) as e:
                print(f"[AUTH] ERROR: Invalid tenant ID format: {tenant_id}, error: {e}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid tenant ID format in token: {tenant_id}"
                )
        else:
            print(f"[AUTH] ERROR: No valid tenant_id in token: {tenant_id}")
            set_tenant_id(None)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No tenant context found in token. Please log in again."
            )

    # Get user by ID
    try:
        user_uuid = UUID(user_id)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID format in token"
        )

    # Try to get user with tenant context first
    user = db.query(User).options(joinedload(User.roles)).filter(User.id == user_uuid).first()

    # If not found and it's a super admin, try global lookup
    if not user and token_data.is_super_admin:
        user = user_crud.get_by_id_global(db, id=user_uuid)

    if not user:
        print(f"[AUTH] ERROR: User {user_uuid} not found")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
        
    if not user.is_active:
        print(f"[AUTH] ERROR: User {user_uuid} is inactive")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    
    print(f"[AUTH] Successfully authenticated user: {user.email} (ID: {user.id})")
    return user


async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    """Get the current active user."""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    return current_user