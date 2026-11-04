from typing import Any, List, Optional
from uuid import UUID
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status, Request, Body, File, UploadFile
from starlette.concurrency import run_in_threadpool
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from pydantic import BaseModel, Field

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
from src.core.security.permissions import has_role, has_any_role, has_permission, require_super_admin
from src.core.middleware.tenant import get_tenant_id_from_request, get_optional_tenant_id_from_request
from src.core.security.auth import get_current_active_user, get_current_user, is_super_admin
from src.core.security.password import verify_password, get_password_hash
from src.services.notification.email_service import EmailService
from src.core.security.password_policy import PasswordPolicy
from src.services.auth.password_strength import calculate_password_strength
from src.core.security.password import generate_default_password
from src.services.logging import AuditLoggingService
from src.services.auth.token_blacklist import TokenBlacklistService
from src.core.redis import cache, REDIS_AVAILABLE
from src.core.security.client_ip import client_ip
from src.services.billing import access as billing_access

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
    
    # Send email notification if a password was generated (accounts may have no email)
    if hasattr(new_user, 'generated_password') and new_user.email:
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
def get_users(
    *,
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id_from_request),
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    role_id: Optional[UUID] = None,
    sort_by: Optional[str] = "created_at",
    sort_order: str = "asc",
    current_user: User = Depends(has_permission("view_users")),
) -> Any:
    """Get all users for a tenant with optional server-side filters."""
    return user_crud.list_with_filters(
        db,
        tenant_id=tenant_id,
        search=search,
        is_active=is_active,
        role_id=role_id,
        sort_by=sort_by,
        sort_order=sort_order,
        skip=skip,
        limit=limit,
        exclude_super_admin=not is_super_admin(current_user)
    )

@router.get("/users/active", response_model=List[User])
def get_active_users(
    *, db: Session = Depends(get_db), tenant_id: UUID = Depends(get_tenant_id_from_request),
    skip: int = 0, limit: int = 100,
    current_user: User = Depends(has_permission("view_users"))
) -> Any:
    """Get all active users for a tenant (super-admins are never listed to schools)."""
    users = user_crud.get_active_users(db, tenant_id=tenant_id, skip=skip, limit=limit)
    if is_super_admin(current_user):
        return users
    return [u for u in users if not is_super_admin(u)]

@router.get("/users/directory")
def user_directory(
    *, db: Session = Depends(get_db), tenant_id: UUID = Depends(get_tenant_id_from_request),
    q: Optional[str] = None, role: Optional[str] = None, status_filter: str = Query("all", alias="status"),
    page: int = 1, page_size: int = 25,
    current_user: User = Depends(has_permission("view_users"))
) -> Any:
    """Everyone in your school, paged, for the Users page: search by name, username, email or
    phone; filter by role name and active/inactive. Platform accounts are never listed."""
    from sqlalchemy import func, or_
    from src.db.models.auth import User as UserModel
    from src.db.models.auth.user_role import UserRole as RoleModel

    if status_filter not in ("all", "active", "inactive"):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="status must be all, active or inactive")
    page = max(page, 1)
    page_size = min(max(page_size, 1), 100)
    query = db.query(UserModel).filter(
        UserModel.tenant_id == tenant_id,
        ~UserModel.roles.any(RoleModel.name.in_(["super-admin", "superadmin"])),
    )
    if q and q.strip():
        term = f"%{q.strip().lower()}%"
        query = query.filter(or_(
            func.lower(func.concat(UserModel.first_name, " ", UserModel.last_name)).like(term),
            func.lower(UserModel.username).like(term),
            func.lower(func.coalesce(UserModel.email, "")).like(term),
            func.coalesce(UserModel.phone_number, "").like(term),
        ))
    if role:
        query = query.filter(UserModel.roles.any(RoleModel.name == role))
    if status_filter != "all":
        query = query.filter(UserModel.is_active == (status_filter == "active"))
    total = query.with_entities(func.count(UserModel.id)).scalar() or 0
    rows = (query.order_by(func.lower(UserModel.first_name), func.lower(UserModel.last_name), UserModel.id)
            .offset((page - 1) * page_size).limit(page_size).all())
    items = [{
        "id": u.id, "name": f"{u.first_name or ''} {u.last_name or ''}".strip(), "username": u.username,
        "email": u.email, "phone_number": u.phone_number, "roles": sorted(r.name for r in u.roles),
        "is_active": u.is_active, "must_change_password": bool(u.is_first_login), "last_login": u.last_login,
    } for u in rows]
    return {"items": items, "total": total, "page": page, "page_size": page_size,
            "pages": (total + page_size - 1) // page_size}


@router.get("/users/{user_id}", response_model=User)
def get_user(
    *, db: Session = Depends(get_db), tenant_id: UUID = Depends(get_tenant_id_from_request), user_id: UUID,
    current_user: User = Depends(get_current_active_user)
) -> Any:
    """Get a specific user by ID (yourself, or anyone in your school with view_users)."""
    if current_user.id != user_id:
        _require_permission(current_user, "view_users")
    user = user_crud.get_by_id(db, tenant_id=tenant_id, id=user_id)
    if not user or (is_super_admin(user) and not is_super_admin(current_user)):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return user

# Fields a user may change on their own account; everything else is admin-managed
SELF_EDITABLE_FIELDS = {"first_name", "last_name", "phone_number", "profile_picture", "preferences", "address"}
# Students and parents keep the name the school recorded (report cards, receipts, ID cards)
SCHOOL_KEPT_NAME_TYPES = {"student", "parent"}


def _has_perm(user: User, permission: str) -> bool:
    return is_super_admin(user) or any(
        p.name == permission for role in user.roles for p in role.permissions
    )


def _require_permission(user: User, permission: str) -> None:
    if not _has_perm(user, permission):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"User does not have permission: {permission}")


@router.put("/users/{user_id}", response_model=User)
def update_user(*, db: Session = Depends(get_db), tenant_id: UUID = Depends(get_tenant_id_from_request), user_id: UUID, user_in: UserUpdate, current_user: User = Depends(get_current_active_user)) -> Any:
    """Update a user.

    - Your own account: profile fields only (name, phone, picture, preferences, address);
      students and parents can't change their name: the school office does.
    - Someone else: needs manage_users, same school, and never a super-admin unless you are one.
    - Passwords never change here: use /change-password or /admin/reset-password.
    """
    changes = user_in.model_dump(exclude_unset=True)
    if "password" in changes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passwords can't be changed here. Use change password or an admin password reset."
        )

    is_self_update = current_user.id == user_id
    actor_is_super_admin = is_super_admin(current_user)
    if is_self_update:
        forbidden = set(changes) - SELF_EDITABLE_FIELDS
        if current_user.type in SCHOOL_KEPT_NAME_TYPES:
            forbidden |= set(changes) & {"first_name", "last_name"}
        if forbidden and not actor_is_super_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"You can't change these fields on your own account: {', '.join(sorted(forbidden))}"
            )
        user = current_user
    else:
        _require_permission(current_user, "manage_users")
        user = user_crud.get_by_id(db, tenant_id=tenant_id, id=user_id)
        if user and is_super_admin(user) and not actor_is_super_admin:
            user = None  # super-admin accounts are invisible to schools

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
    
    update_tenant_id = user.tenant_id
    updated_user = user_crud.update(db, tenant_id=update_tenant_id, db_obj=user, obj_in=changes)
    
    # Log the activity
    try:
        audit_service = AuditLoggingService(db=db, tenant_id=update_tenant_id)
        audit_service.log_activity(
            user_id=current_user.id,
            action="update",
            entity_type="user",
            entity_id=user_id,
            old_values=old_values,
            new_values=changes
        )
    except Exception as e:
        print(f"Error logging user update activity: {e}")
    
    return updated_user

# Update the delete_user function
@router.delete("/users/{user_id}", response_model=User)
def delete_user(*, db: Session = Depends(get_db), tenant_id: UUID = Depends(get_tenant_id_from_request), user_id: UUID, current_user: User = Depends(has_permission("delete_users"))) -> Any:
    """Delete a user in your school (never yourself, never a super-admin unless you are one)."""
    if current_user.id == user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You can't delete your own account")
    user = user_crud.get_by_id(db, tenant_id=tenant_id, id=user_id)
    if user and is_super_admin(user) and not is_super_admin(current_user):
        user = None
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
def create_permission(
    *,
    db: Session = Depends(get_db),
    permission_in: PermissionCreate,
    current_user: User = Depends(require_super_admin())
) -> Any:
    """Create a new permission (super-admin: the catalogue is shared by every school)."""
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
# --- Roles: system roles (shared, platform-managed) and per-school custom roles -------------

# Permissions that act across schools: never granted by a school's custom role
PLATFORM_PERMISSIONS = {
    "manage_tenants", "manage_permissions", "view_all_audit_logs", "view_all_users", "view_system_reports",
}
# Names the code checks by role name (has_any_role, attendance access, ...): custom roles can't use them
RESERVED_ROLE_NAMES = {"super-admin", "superadmin", "admin", "principal", "dean"}


def _normalize_role_name(name: str) -> str:
    return "-".join(name.split()).lower().replace("_", "-")


def _role_tenant(request: Request) -> Optional[UUID]:
    """The school roles are managed for: the caller's school (a super-admin's chosen one, or None)."""
    return getattr(request.state, "tenant_id", None)


def _visible_role(db: Session, request: Request, role_id: UUID, current_user: User):
    role = user_role_crud.get_visible(db, role_id=role_id, tenant_id=_role_tenant(request))
    if role is None and is_super_admin(current_user):
        role = user_role_crud.get(db, id=role_id)
    if role is None or (role.name in ("super-admin", "superadmin") and not is_super_admin(current_user)):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
    return role


def _editable_role(db: Session, request: Request, role_id: UUID, current_user: User):
    """System roles change only on the platform; a school edits its own custom roles."""
    role = _visible_role(db, request, role_id, current_user)
    if role.tenant_id is None and not is_super_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Built-in roles are shared by every school and can't be changed. Create a custom role instead.",
        )
    return role


def _school_user_for_roles(db: Session, tenant_id: UUID, user_id: UUID, current_user: User):
    user = user_crud.get_by_id(db, tenant_id=tenant_id, id=user_id)
    if not user or (is_super_admin(user) and not is_super_admin(current_user)):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.post("/roles", response_model=UserRole, status_code=status.HTTP_201_CREATED)
def create_role(
    *, request: Request, db: Session = Depends(get_db), role_in: UserRoleCreate,
    current_user: User = Depends(has_permission("manage_roles"))
) -> Any:
    """Create a role.

    A school admin creates a custom role for their own school; a super-admin with no school
    chosen creates a system role shared by every school.
    """
    tenant_id = _role_tenant(request)
    name = " ".join(role_in.name.split())
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Role name is required")
    normalized = _normalize_role_name(name)
    system_names = {_normalize_role_name(r.name) for r in user_role_crud.list_visible(db, tenant_id=None) if r.tenant_id is None}
    if tenant_id is not None and (normalized in system_names or normalized in RESERVED_ROLE_NAMES):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"'{name}' is a built-in role name. Choose another name.",
        )
    taken = any(
        r.tenant_id == tenant_id and _normalize_role_name(r.name) == normalized
        for r in user_role_crud.list_visible(db, tenant_id=tenant_id)
    )
    if taken:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Role with this name already exists")
    role = user_role_crud.model(
        name=name, description=role_in.description,
        tenant_id=tenant_id, is_system=tenant_id is None,
    )
    db.add(role)
    db.commit()
    db.refresh(role)
    return role


@router.get("/roles", response_model=List[UserRole])
def get_roles(
    *,
    request: Request,
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user)
) -> Any:
    """Built-in roles plus the caller's school's custom roles."""
    roles = user_role_crud.list_visible(db, tenant_id=_role_tenant(request))
    if not is_super_admin(current_user):
        roles = [r for r in roles if r.name not in ("super-admin", "superadmin")]
    return roles[skip:skip + limit]


@router.delete("/roles/{role_id}", response_model=UserRole)
def delete_role(
    *, request: Request, db: Session = Depends(get_db), role_id: UUID,
    current_user: User = Depends(has_permission("manage_roles"))
) -> Any:
    """Delete a role nobody holds (a school deletes its custom roles; built-in: super-admin only)."""
    role = _editable_role(db, request, role_id, current_user)
    if role.users:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Remove this role from its users before deleting it.",
        )
    role.permissions = []
    db.delete(role)
    db.commit()
    return role


# Redis-based login throttling (15-minute windows):
# - per IP: at most LOGIN_ATTEMPTS_PER_IP attempts (a whole school may share one IP);
# - per account: locked after LOGIN_FAILURES_PER_ACCOUNT failed passwords.
LOGIN_WINDOW_SECONDS = 900
LOGIN_ATTEMPTS_PER_IP = 30
LOGIN_FAILURES_PER_ACCOUNT = 5
TOO_MANY_ATTEMPTS = HTTPException(
    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
    detail="Too many login attempts. Please wait 15 minutes and try again."
)


async def _login_cache():
    if not REDIS_AVAILABLE:
        return None
    if not cache.client:
        await cache.connect()
    return cache.client


def _account_key(username: str) -> str:
    return f"login_failures:{(username or '').strip().lower()}"


async def rate_limit_login(request: Request):
    client = await _login_cache()
    if not client:
        return
    form = await request.form()
    ip_key = f"login_attempts:{client_ip(request)}"
    try:
        async with client.pipeline() as pipe:
            await pipe.incr(ip_key)
            await pipe.expire(ip_key, LOGIN_WINDOW_SECONDS)
            await pipe.get(_account_key(form.get("username", "")))
            ip_count, _, account_failures = await pipe.execute()
    except Exception as e:
        print(f"Rate limiting error: {e}")  # Redis trouble must not block every login
        return
    if ip_count > LOGIN_ATTEMPTS_PER_IP or int(account_failures or 0) >= LOGIN_FAILURES_PER_ACCOUNT:
        raise TOO_MANY_ATTEMPTS


async def _record_login_failure(username: str) -> None:
    client = await _login_cache()
    if not client:
        return
    try:
        async with client.pipeline() as pipe:
            await pipe.incr(_account_key(username))
            await pipe.expire(_account_key(username), LOGIN_WINDOW_SECONDS)
            await pipe.execute()
    except Exception as e:
        print(f"Rate limiting error: {e}")


async def _clear_login_failures(username: str) -> None:
    client = await _login_cache()
    if client:
        try:
            await client.delete(_account_key(username))
        except Exception as e:
            print(f"Rate limiting error: {e}")


@router.post("/login", response_model=Token, dependencies=[Depends(rate_limit_login)])
async def login_for_access_token(
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
            await _record_login_failure(form_data.username)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        tenant_id = user.tenant_id
    else:
        user = user_crud.authenticate(db, tenant_id=tenant_id, email=form_data.username, password=form_data.password)
        if not user:
            await _record_login_failure(form_data.username)
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
    
    await _clear_login_failures(form_data.username)
    # A suspended school (platform billing) lets only its admins in
    billing_access.check_sign_in(db, user)

    # Cache super-admin status before commit (which expires the object)
    super_admin = is_super_admin(user)
    user_id = user.id
    user_tenant_id = user.tenant_id

    # Update last login timestamp, and note this month's use (billing; never fails the sign-in)
    user.last_login = datetime.now(timezone.utc)
    db.add(user)
    billing_access.record_activity(db, user)
    db.commit()
    # Skipping db.refresh(user) as it can cause InvalidRequestError with polymorphic models
    # and we have the necessary data cached.

    # Tokens always carry the user's own school (a super-admin picks a school per request)
    final_tenant_id = user_tenant_id
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        subject=user_id,
        tenant_id=final_tenant_id,
        is_super_admin=super_admin,
        expires_delta=access_token_expires
    )
    refresh_token = create_refresh_token(
        subject=str(user_id),
        tenant_id=str(final_tenant_id),
        is_super_admin=super_admin
    )
    # Initialize last activity for the new access token
    issued_payload = await verify_token(access_token)
    if issued_payload and issued_payload.jti:
        from src.services.auth.token_blacklist import TokenBlacklistService
        await TokenBlacklistService().ensure_last_activity(issued_payload.jti, issued_payload.exp)
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }

@router.post("/refresh", response_model=Token)
async def refresh_access_token(
    request: Request,
    refresh_token: Optional[str] = Body(None, embed=True),
    db: Session = Depends(get_db)
) -> Any:
    """Refresh access token using refresh token."""
    try:
        # Extract token from Body OR Authorization header
        if not refresh_token:
            auth_header = request.headers.get("Authorization")
            if auth_header and auth_header.startswith("Bearer "):
                refresh_token = auth_header.split(" ")[1]
        
        if not refresh_token:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Refresh token required in body or Authorization header"
            )
        # Only a refresh token can refresh (an access token, or a revoked one, can't)
        token_data = await verify_token(refresh_token, expected_type="refresh")
        if not token_data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )

        user = user_crud.get_by_id_global(db, id=UUID(token_data.sub))
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or inactive"
            )

        # Identity comes from the database, not the old token: the user's own school,
        # and super-admin status from their current roles
        super_admin = is_super_admin(user)
        final_tenant_id = user.tenant_id
        billing_access.check_sign_in(db, user)
        billing_access.record_activity(db, user)

        # Rotate: the presented refresh token can't be used again
        await TokenBlacklistService().blacklist_token(refresh_token, token_data.exp)

        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        new_access_token = create_access_token(
            subject=str(user.id),
            tenant_id=str(final_tenant_id),
            is_super_admin=super_admin,
            expires_delta=access_token_expires
        )
        new_refresh_token = create_refresh_token(
            subject=str(user.id),
            tenant_id=str(final_tenant_id),
            is_super_admin=super_admin
        )
        # Initialize last activity for the refreshed access token
        issued_payload = await verify_token(new_access_token)
        if issued_payload and issued_payload.jti:
            await TokenBlacklistService().ensure_last_activity(issued_payload.jti, issued_payload.exp)
        return {
            "access_token": new_access_token,
            "refresh_token": new_refresh_token,
            "token_type": "bearer",
        }
        
    except HTTPException:
        raise
    except Exception:
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

def _signatures(db: Session = Depends(get_db), tenant_id: UUID = Depends(get_tenant_id_from_request),
                current_user: User = Depends(get_current_active_user)):
    from src.services.academics.report_identity_service import SignatureService
    return SignatureService(db, tenant_id, current_user)


@router.get("/me/signature")
def get_my_signature(service=Depends(_signatures)) -> Any:
    """The signed-in staff member's current signature (phase4-design.md §6)."""
    return service.get()


@router.put("/me/signature")
async def put_my_signature(file: UploadFile = File(...), service=Depends(_signatures)) -> Any:
    """Upload (or draw) the signed-in staff member's own signature; PNG or JPEG, at most 1 MB."""
    from src.services.academics.report_identity_service import image_error
    from src.utils.report_images import ImageRejected, read_upload
    try:
        raw = await read_upload(file)
    except ImageRejected as err:
        raise image_error(err)
    return await run_in_threadpool(service.set, raw)


@router.delete("/me/signature")
def delete_my_signature(service=Depends(_signatures)) -> Any:
    """Stop using the current signature; cards already published keep showing it."""
    return service.clear()


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


# Accounts with one of these roles can only be reset by someone who has one too
SCHOOL_ADMIN_ROLE_NAMES = ("admin", "tenant-admin")


def _is_school_admin(user: User) -> bool:
    return any(role.name in SCHOOL_ADMIN_ROLE_NAMES for role in user.roles)


@router.post("/admin/reset-password/{user_id}")
async def admin_reset_password(
    user_id: UUID,
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id_from_request),
    current_user: User = Depends(has_permission("manage_users"))
) -> Any:
    """Reset the password of anyone in your own school (student, parent, teacher, staff).

    The new password is returned once so the admin can hand it over in person (many families
    have no email); it is never emailed. The user must choose their own at next sign-in
    (is_first_login), every session they had ends, and any sign-in lockout is lifted.
    Another school's account, or a platform account, is 404. A school admin's account can only
    be reset by a school admin.
    """
    if current_user.id == user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Use change password for your own account")
    user = user_crud.get_by_id(db, tenant_id=tenant_id, id=user_id)
    if user and is_super_admin(user) and not is_super_admin(current_user):
        user = None
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if _is_school_admin(user) and not (_is_school_admin(current_user) or is_super_admin(current_user)):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Only a school admin can reset an admin's password")

    new_password = generate_default_password()
    user.password_hash = get_password_hash(new_password)
    user.is_first_login = True
    db.add(user)
    db.flush()

    await TokenBlacklistService().revoke_user_sessions(user.id)
    for name in {user.email, getattr(user, "username", None)} - {None, ""}:
        await _clear_login_failures(name)

    return {
        "message": "Password reset successful",
        "generated_password": new_password,
        "username": getattr(user, "username", None),
        "email": user.email,
    }


class StaffAccountIn(BaseModel):
    first_name: str = Field(..., max_length=100)
    last_name: str = Field(..., max_length=100)
    email: Optional[str] = Field(None, max_length=255)
    username: Optional[str] = Field(None, max_length=50)
    phone_number: Optional[str] = Field(None, max_length=20)
    role_id: UUID


def _staff_accounts(db: Session, tenant_id: UUID, current_user: User):
    from src.services.auth.staff_accounts import StaffAccountService
    return StaffAccountService(db, tenant_id, _is_school_admin(current_user) or is_super_admin(current_user))


@router.get("/staff-roles")
def staff_roles(
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id_from_request),
    current_user: User = Depends(has_permission("manage_users"))
) -> Any:
    """The roles you may give a new staff account (admin only if you are a school admin)."""
    return [{"id": r.id, "name": r.name, "description": r.description, "is_system": r.tenant_id is None}
            for r in _staff_accounts(db, tenant_id, current_user).roles()]


@router.post("/staff-accounts", status_code=status.HTTP_201_CREATED)
def create_staff_account(
    body: StaffAccountIn,
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id_from_request),
    current_user: User = Depends(has_permission("manage_users"))
) -> Any:
    """Create a staff account in your own school with one staff role.

    The password is returned once to hand over in person (never emailed); they choose their own at
    first sign-in. Only a school admin may create an admin account.
    """
    return _staff_accounts(db, tenant_id, current_user).create(body.model_dump())


@router.put("/roles/{role_id}/permissions", response_model=UserRole)
def set_role_permissions(
    *,
    request: Request,
    db: Session = Depends(get_db),
    role_id: UUID,
    permission_names: List[str] = Body(..., description="List of permission names to set for the role"),
    current_user: User = Depends(has_permission("manage_roles"))
) -> Any:
    """Replace a role's permissions.

    Schools edit their own custom roles, without platform permissions; built-in roles apply
    in every school, so only a super-admin changes them.
    """
    role = _editable_role(db, request, role_id, current_user)
    names = sorted(set(permission_names))
    if role.tenant_id is not None:
        platform = sorted(set(names) & PLATFORM_PERMISSIONS)
        if platform:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"These permissions are platform-only: {', '.join(platform)}",
            )
    permissions = permission_crud.get_multi_by_names(db, names=names)
    if len(permissions) != len(names):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="One or more permissions not found")

    # Replace the role's permissions with the provided set
    role.permissions = permissions
    db.add(role)
    db.commit()
    db.refresh(role)
    return role


@router.get("/roles/{role_id}/permissions", response_model=List[Permission])
def get_role_permissions(
    *,
    request: Request,
    db: Session = Depends(get_db),
    role_id: UUID,
    current_user: User = Depends(has_permission("manage_roles"))
) -> Any:
    """Get permissions assigned to a role."""
    return _visible_role(db, request, role_id, current_user).permissions


# Add these endpoints to your existing auth.py

@router.get("/users/{user_id}/roles", response_model=List[UserRole])
def get_user_roles(
    *,
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id_from_request),
    user_id: UUID,
    current_user: User = Depends(has_permission("view_users"))
) -> Any:
    """Get roles assigned to a user (tenant-scoped)."""
    return _school_user_for_roles(db, tenant_id, user_id, current_user).roles


@router.post("/users/{user_id}/roles")
def assign_roles_to_user(
    request: Request,
    user_id: UUID,
    role_ids: List[UUID] = Body(..., description="List of role IDs to assign"),
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id_from_request),
    current_user: User = Depends(has_permission("manage_users"))
):
    """Assign built-in roles or this school's custom roles to a user of this school."""
    user = _school_user_for_roles(db, tenant_id, user_id, current_user)
    roles = [_visible_role(db, request, role_id, current_user) for role_id in set(role_ids)]
    if not roles:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No valid roles provided")
    if any(role.tenant_id not in (None, user.tenant_id) for role in roles):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A custom role belongs to another school")

    for role in roles:
        if role not in user.roles:
            user.roles.append(role)

    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}/roles/{role_id}", operation_id="remove_role_from_user")
def remove_role_from_user(
    request: Request,
    user_id: UUID,
    role_id: UUID,
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id_from_request),
    current_user: User = Depends(has_permission("manage_users"))
):
    """Remove a role from a user."""
    user = _school_user_for_roles(db, tenant_id, user_id, current_user)
    role = _visible_role(db, request, role_id, current_user)

    if role in user.roles:
        user.roles.remove(role)

    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/roles/{role_id}/users", response_model=List[User], operation_id="get_users_with_role")
def get_users_with_role(
    request: Request,
    role_id: UUID,
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id_from_request),
    current_user: User = Depends(has_permission("view_users"))
):
    """Get this school's users with a specific role."""
    _visible_role(db, request, role_id, current_user)
    return user_crud.list_with_filters(
        db,
        tenant_id=tenant_id,
        role_id=role_id,
        skip=0,
        limit=100,
        exclude_super_admin=not is_super_admin(current_user)
    )


@router.post("/logout", operation_id="logout")
async def logout(
    request: Request,
    refresh_token: Optional[str] = Body(None, embed=True),
) -> Any:
    """Log out: revoke the access token (Authorization header) and the refresh token (body).

    Public route so an expired access token can still revoke its refresh token.
    """
    auth_header = request.headers.get("Authorization", "")
    access_token = auth_header[7:] if auth_header.startswith("Bearer ") else None
    blacklist_service = TokenBlacklistService()
    for token, token_type in ((access_token, "access"), (refresh_token, "refresh")):
        if not token:
            continue
        try:
            token_data = await verify_token(token, expected_type=token_type)
            if token_data:
                await blacklist_service.blacklist_token(token, token_data.exp)
        except Exception as e:
            print(f"Logout warning: {e}")
    return {"message": "Successfully logged out", "status": "success"}

@router.put("/permissions/{permission_id}", response_model=Permission)
def update_permission(
    *,
    db: Session = Depends(get_db),
    permission_id: UUID,
    permission_in: PermissionUpdate,
    current_user: User = Depends(require_super_admin())
) -> Any:
    """Update a permission (super-admin)."""
    permission = permission_crud.get(db, id=permission_id)
    if not permission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Permission not found")
    return permission_crud.update(db, db_obj=permission, obj_in=permission_in)

@router.delete("/permissions/{permission_id}", response_model=Permission)
def delete_permission(
    *,
    db: Session = Depends(get_db),
    permission_id: UUID,
    current_user: User = Depends(require_super_admin())
) -> Any:
    """Delete a permission (super-admin)."""
    permission = permission_crud.get(db, id=permission_id)
    if not permission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Permission not found")
    deleted = permission_crud.remove(db, id=permission_id)
    return deleted