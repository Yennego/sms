from typing import List, Optional
from fastapi import Depends, HTTPException, status

from src.db.models.auth import User, Permission
# Change this import to avoid circular dependency
from src.core.security.auth import get_current_user, get_current_active_user, is_super_admin as _is_super_admin
from src.core.security.effective import effective_permission_names


def _system_role_names(user: User) -> set:
    """Names of the user's built-in roles. Role-name checks never match a school's custom
    role (which only grants what its permissions say), even if it shares a name."""
    return {role.name for role in user.roles if getattr(role, "tenant_id", None) is None}

def has_permission(required_permission: str):
    """Dependency to check if user has a specific permission."""
    async def dependency(current_user: User = Depends(get_current_active_user)) -> User:
        if _is_super_admin(current_user):
            return current_user

        # Through any of their roles, as adjusted for their school
        if required_permission not in effective_permission_names(current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"User does not have permission: {required_permission}"
            )
        return current_user
    return dependency


def has_any_permission(permissions: List[str]):
    """Dependency: the user needs at least one of the permissions (super-admins always pass)."""
    async def dependency(current_user: User = Depends(get_current_active_user)) -> User:
        if _is_super_admin(current_user):
            return current_user
        if not effective_permission_names(current_user) & set(permissions):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"User needs one of these permissions: {', '.join(permissions)}"
            )
        return current_user
    return dependency


def has_role_or_permission(roles: List[str], permissions: List[str]):
    """Dependency: one of the built-in roles, or one of the permissions (super-admins always pass).

    For pages shared by staff and families: teachers, students and parents keep their role-based
    access (their services narrow what they see), and office staff get in by permission.
    """
    async def dependency(current_user: User = Depends(get_current_active_user)) -> User:
        if _is_super_admin(current_user) or _system_role_names(current_user) & set(roles):
            return current_user
        if not holds_any_permission(current_user, permissions):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"User needs one of these permissions: {', '.join(permissions)}"
            )
        return current_user
    return dependency


def holds_any_permission(user: User, permissions: List[str]) -> bool:
    if _is_super_admin(user):
        return True
    return bool(effective_permission_names(user) & set(permissions))


def has_role(required_role: str):
    """Dependency to check if user has a specific role."""
    async def dependency(current_user: User = Depends(get_current_active_user)) -> User:
        if _is_super_admin(current_user):
            return current_user

        # Check if user has the required role
        has_required_role = required_role in _system_role_names(current_user)
                
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
        if _is_super_admin(current_user):
            return current_user
            
        # Check if user has any of the required roles
        user_roles = _system_role_names(current_user)
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
        # Super-admins can access any tenant
        if _is_super_admin(current_user):
            return current_user
            
        # For regular admins, check if they have the admin role
        is_admin = "admin" in _system_role_names(current_user)
        
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
        if not _is_super_admin(current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Super-admin privileges required"
            )
        return current_user
    return dependency