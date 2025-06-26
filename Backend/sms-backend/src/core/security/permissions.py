from typing import List, Optional
from fastapi import Depends, HTTPException, status

from src.db.models.auth import User, Permission
# Change this import to avoid circular dependency
from src.core.security.auth import get_current_user, get_current_active_user

def has_permission(required_permission: str):
    """Dependency to check if user has a specific permission."""
    async def dependency(current_user: User = Depends(get_current_active_user)) -> User:
        # Check if user has the required permission through any of their roles
        has_perm = False
        for role in current_user.roles:
            for permission in role.permissions:
                if permission.name == required_permission:
                    has_perm = True
                    break
            if has_perm:
                break
                
        if not has_perm:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"User does not have permission: {required_permission}"
            )
        return current_user
    return dependency


def has_role(required_role: str):
    """Dependency to check if user has a specific role."""
    async def dependency(current_user: User = Depends(get_current_active_user)) -> User:
        # Check if user has the required role
        has_required_role = any(role.name == required_role for role in current_user.roles)
                
        if not has_required_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"User does not have required role: {required_role}"
            )
        return current_user
    return dependency


def has_any_role(required_roles: List[str]):
    """Dependency to check if user has any of the specified roles."""
    async def dependency(current_user: User = Depends(get_current_active_user)) -> User:
        # Check if user has any of the required roles
        user_roles = {role.name for role in current_user.roles}
        if not any(role in user_roles for role in required_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"User does not have any required roles: {', '.join(required_roles)}"
            )
        return current_user
    return dependency


# Add this new function to permissions.py
def admin_with_tenant_check():
    """Dependency that allows super-admins to access any tenant, but restricts admins to their specific tenant."""
    async def dependency(current_user: User = Depends(get_current_active_user)) -> User:
        # Check if user has super-admin role
        is_super_admin = any(role.name == "super-admin" for role in current_user.roles)
        
        # Super-admins can access any tenant
        if is_super_admin:
            return current_user
            
        # For regular admins, check if they have the admin role
        is_admin = any(role.name == "admin" for role in current_user.roles)
        
        if not is_admin:
            # Add more detailed error message
            roles = [role.name for role in current_user.roles]
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Admin or Super-admin privileges required. Current roles: {roles}"
            )
        
        return current_user
    return dependency


def require_super_admin():
    """Dependency to check if user is a super-admin."""
    async def dependency(current_user: User = Depends(get_current_active_user)) -> User:
        # Check if user has the super-admin role
        is_super_admin = any(role.name == "super-admin" for role in current_user.roles)
                
        if not is_super_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Super-admin privileges required"
            )
        return current_user
    return dependency