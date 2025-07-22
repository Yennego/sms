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
    token_data = verify_token(token)
    if not token_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    tenant_id = token_data.tenant_id
    user_id = token_data.sub

    # Set tenant ID in context with proper validation
    if tenant_id and tenant_id != "None" and tenant_id != "null":
        try:
            tenant_id_uuid = UUID(tenant_id)
            set_tenant_id(tenant_id_uuid)  # Pass UUID object directly
            print(f"Successfully set tenant_id in context: {tenant_id_uuid}")
        except (ValueError, TypeError) as e:
            # Log the error and raise an exception instead of silently ignoring
            print(f"Failed to set tenant_id in context: {tenant_id}, error: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid tenant context in token: {tenant_id}"
            )
    else:
        print(f"No valid tenant_id in token: {tenant_id}")
        # For dashboard endpoints, we need tenant context
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No tenant context found in token"
        )

    # Get user by ID
    user = db.query(User).options(joinedload(User.roles)).filter(User.id == UUID(user_id)).first()

    if not user:
        user = user_crud.get_by_id_global(db, id=UUID(user_id))

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    return user


async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    """Get the current active user."""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    return current_user