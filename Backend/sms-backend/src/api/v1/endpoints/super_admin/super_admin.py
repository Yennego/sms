from typing import Any, List, Optional, Dict
from uuid import UUID, uuid4
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, text
from sqlalchemy.exc import IntegrityError
from psycopg2.errors import UniqueViolation

from src.db.crud import tenant as tenant_crud
from src.db.crud import tenant_settings as tenant_settings_crud
from src.db.crud import user as user_crud
from src.db.crud import user_role as user_role_crud
from src.db.crud import permission as permission_crud
from src.db.crud.tenant import notification_config as notification_config_crud
from src.db.session import get_super_admin_db, get_db
from src.schemas.base.base import PaginatedResponse
from src.schemas.tenant import Tenant, TenantCreate, TenantUpdate, TenantCreateWithAdmin, TenantCreateResponse
from src.schemas.tenant import TenantSettings, TenantSettingsCreate, TenantSettingsUpdate
from src.schemas.tenant.notification_config import TenantNotificationConfigCreate
from src.schemas.auth import User as UserSchema
from src.schemas.auth.user import UserWithRoles, UserCreateCrossTenant, UserCreateResponse, UserUpdate
from src.schemas.auth.user_role import UserRole, UserRoleCreate
from src.schemas.auth.permission import Permission, PermissionCreate

# Import SQLAlchemy models for database queries
from src.db.models.auth.user import User
from src.db.models.auth.user_role import UserRole as UserRoleModel
from src.db.models.auth.permission import Permission as PermissionModel
from src.db.models.tenant.tenant import Tenant as TenantModel
from src.db.models.tenant.notification_config import TenantNotificationConfig

# Import security and utility functions
from src.core.security.password import get_password_hash
from src.services.auth.password import generate_default_password
from src.core.security.permissions import require_super_admin
from src.services.tenant.dashboard import DashboardMetricsService
from src.services.email import send_new_user_email

router = APIRouter()

@router.get("/tenants", response_model=PaginatedResponse[Tenant])
def get_all_tenants(
    *,
    db: Session = Depends(get_super_admin_db),
    _: User = Depends(require_super_admin()),
    skip: int = 0,
    limit: int = 100
) -> Any:
    """Get all tenants with pagination (super-admin only)."""
    tenants, total = tenant_crud.get_multi_with_count(db, skip=skip, limit=limit)
    
    return PaginatedResponse(
        items=tenants,
        total=total,
        skip=skip,
        limit=limit,
        has_next=skip + limit < total,
        has_prev=skip > 0
    )

@router.post("/tenants", response_model=Tenant, status_code=status.HTTP_201_CREATED, deprecated=True)
def create_tenant(
    *,
    db: Session = Depends(get_super_admin_db),
    _: User = Depends(require_super_admin()),
    tenant_in: TenantCreate
) -> Any:
    """Create a new tenant (super-admin only).
    
    DEPRECATED: Use /tenants/with-admin endpoint instead to ensure atomic tenant and admin user creation.
    This endpoint creates only the tenant without an admin user, which may leave the tenant in an incomplete state.
    """
    # Add detailed logging for debugging
    print(f"[DEBUG] Attempting to create tenant with data: {tenant_in.model_dump()}")
    print(f"[DEBUG] Raw tenant data type: {type(tenant_in)}")
    print(f"[DEBUG] Raw tenant data dir: {dir(tenant_in)}")
    
    # Validate code format
    if not tenant_in.code:
        print(f"[DEBUG] Tenant code is empty")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Tenant code is required"
        )
    
    print(f"[DEBUG] Tenant code value: '{tenant_in.code}', type: {type(tenant_in.code)}")
    print(f"[DEBUG] Tenant code length: {len(tenant_in.code)}")
    
    if len(tenant_in.code) < 2:
        print(f"[DEBUG] Tenant code too short: {tenant_in.code}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Tenant code must be at least 2 characters long"
        )
    
    print(f"[DEBUG] Checking if code is alphanumeric: '{tenant_in.code}'")
    print(f"[DEBUG] isalnum() result: {tenant_in.code.isalnum()}")
    
    if not tenant_in.code.isalnum():
        print(f"[DEBUG] Tenant code contains non-alphanumeric characters: {tenant_in.code}")
        print(f"[DEBUG] Character analysis: {[(c, c.isalnum()) for c in tenant_in.code]}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Tenant code must contain only alphanumeric characters"
        )
    
    # Check for existing tenant
    print(f"[DEBUG] Checking for existing tenant with code: {tenant_in.code}")
    tenant_obj = tenant_crud.get_by_code(db, code=tenant_in.code)
    if tenant_obj:
        print(f"[DEBUG] Tenant with code {tenant_in.code} already exists (ID: {tenant_obj.id})")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant with this code already exists"
        )
    
    # Validate name
    if not tenant_in.name:
        print(f"[DEBUG] Tenant name is empty")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Tenant name is required"
        )
    
    print(f"[DEBUG] Tenant name value: '{tenant_in.name}', type: {type(tenant_in.name)}")
    print(f"[DEBUG] Tenant name length: {len(tenant_in.name)}")
    
    if len(tenant_in.name) < 3:
        print(f"[DEBUG] Tenant name too short: {tenant_in.name}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Tenant name must be at least 3 characters long"
        )
    
    try:
        print(f"[DEBUG] Creating tenant in database")
        new_tenant = tenant_crud.create(db, obj_in=tenant_in)
        print(f"[DEBUG] Successfully created tenant: {new_tenant.id} - {new_tenant.code}")
        
        # Create default notification configuration for the tenant
        notification_config = TenantNotificationConfigCreate(
            tenant_id=str(new_tenant.id),
            whatsapp_enabled=True,
            school_name=new_tenant.name,
            notify_admin_on_user_creation=True,
            notify_parents_on_student_creation=True,
            teacher_welcome_template="Welcome to {school_name}! Your login credentials are: Email: {email}, Password: {password}",
            student_welcome_template="Welcome {student_name} to {school_name}! Your login credentials are: Email: {email}, Password: {password}",
            parent_welcome_template="Welcome! Your child {student_name} has been enrolled at {school_name}. Your login credentials are: Email: {email}, Password: {password}"
        )
        notification_config_crud.create(db, obj_in=notification_config)
        
        return new_tenant
    except Exception as e:
        print(f"[DEBUG] Error creating tenant: {str(e)}")
        import traceback
        print(f"[DEBUG] Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating tenant: {str(e)}"
        )

@router.post("/tenants/with-admin", response_model=TenantCreateResponse, status_code=status.HTTP_201_CREATED)
def create_tenant_with_admin(
    *,
    db: Session = Depends(get_super_admin_db),
    _: User = Depends(require_super_admin()),
    tenant_data: TenantCreateWithAdmin
) -> Any:
    """Create a new tenant with admin user atomically (super-admin only)."""
    print(f"[DEBUG] Creating tenant with admin: {tenant_data.model_dump()}")
    
    # Validate tenant code format
    if not tenant_data.code:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Tenant code is required"
        )
    
    if len(tenant_data.code) < 2:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Tenant code must be at least 2 characters long"
        )
    
    if not tenant_data.code.isalnum():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Tenant code must contain only alphanumeric characters"
        )
    
    # Check for existing tenant
    tenant_obj = tenant_crud.get_by_code(db, code=tenant_data.code)
    if tenant_obj:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant with this code already exists"
        )
    
    # Validate tenant name
    if not tenant_data.name or len(tenant_data.name) < 3:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Tenant name must be at least 3 characters long"
        )
    
    # Validate admin user email format
    import re
    email_pattern = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
    if not re.match(email_pattern, tenant_data.admin_user.email):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid email format for admin user"
        )
    


    # Check if admin user email already exists globally (across all tenants) BEFORE starting transaction
    existing_user = user_crud.get_by_email_any_tenant(db, email=tenant_data.admin_user.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists in the system. Please use a different email address."
        )

    try:
        # Start transaction - all operations will be in one transaction
        print(f"[DEBUG] Starting transaction for tenant and admin creation")
        
        # Create tenant manually (without auto-commit)
        new_tenant = TenantModel(
            id=uuid4(),
            name=tenant_data.name,
            code=tenant_data.code,
            is_active=tenant_data.is_active,
            domain=tenant_data.domain,
            subdomain=tenant_data.subdomain,
            logo=tenant_data.logo,
            primary_color=tenant_data.primary_color,
            secondary_color=tenant_data.secondary_color
        )
        db.add(new_tenant)
        db.flush()  # Get the ID without committing
        print(f"[DEBUG] Created tenant: {new_tenant.id} - {new_tenant.code}")
        
        # Create default notification configuration for the tenant
        notification_config = TenantNotificationConfig(
            id=uuid4(),
            tenant_id=new_tenant.id,
            whatsapp_enabled=True,
            school_name=new_tenant.name,
            notify_admin_on_user_creation=True,
            notify_parents_on_student_creation=True,
            teacher_welcome_template="Welcome to {school_name}! Your login credentials are: Email: {email}, Password: {password}",
            student_welcome_template="Welcome {student_name} to {school_name}! Your login credentials are: Email: {email}, Password: {password}",
            parent_welcome_template="Welcome! Your child {student_name} has been enrolled at {school_name}. Your login credentials are: Email: {email}, Password: {password}"
        )
        db.add(notification_config)
        db.flush()
        print(f"[DEBUG] Created notification config for tenant: {new_tenant.id}")
        
        # Generate password if not provided
        admin_password = tenant_data.admin_user.password
        password_was_generated = False
        generated_password = None
        
        if not admin_password:
            password_was_generated = True
            generated_password = generate_default_password()
            admin_password = generated_password
            print(f"[DEBUG] Generated password for admin user")
        
        # Create admin user manually (without auto-commit)
        admin_user = User(
            id=uuid4(),
            first_name=tenant_data.admin_user.first_name,
            last_name=tenant_data.admin_user.last_name,
            email=tenant_data.admin_user.email,
            password_hash=get_password_hash(admin_password),
            is_active=True,
            tenant_id=new_tenant.id,
            type="admin"
        )
        db.add(admin_user)
        db.flush()  # Get the ID without committing
        print(f"[DEBUG] Created admin user: {admin_user.id} - {admin_user.email}")
        
        # Assign admin role to the user
        admin_role = user_role_crud.get_by_name(db, name="admin")
        if admin_role:
            db.execute(
                text("INSERT INTO user_role_association (user_id, role_id) VALUES (:user_id, :role_id)"),
                {"user_id": str(admin_user.id), "role_id": str(admin_role.id)}
            )
            print(f"[DEBUG] Assigned admin role to user: {admin_user.email}")
        else:
            print(f"[DEBUG] Admin role not found in database")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Admin role not found in system"
            )
        
        # Commit all changes at once
        db.commit()
        print(f"[DEBUG] Transaction committed successfully")
        
        # Send email with login details if password was generated
        if password_was_generated and generated_password:
            try:
                send_new_user_email(admin_user.email, admin_user.first_name, generated_password)
                print(f"[DEBUG] Sent welcome email to admin user: {admin_user.email}")
            except Exception as e:
                print(f"[DEBUG] Error sending email: {e}")
                # Don't fail the entire operation for email issues
        
        # Prepare response
        admin_user_response = {
            "id": str(admin_user.id),
            "email": admin_user.email,
            "first_name": admin_user.first_name,
            "last_name": admin_user.last_name,
            "is_active": admin_user.is_active,
            "created_at": admin_user.created_at.isoformat(),
        }
        
        if password_was_generated and generated_password:
            admin_user_response["generated_password"] = generated_password
        
        response = TenantCreateResponse(
            tenant=new_tenant,
            admin_user=admin_user_response
        )
        
        print(f"[DEBUG] Successfully created tenant with admin user")
        return response
        
    except HTTPException:
        # Rollback transaction for HTTP exceptions
        db.rollback()
        print(f"[DEBUG] Transaction rolled back due to HTTP exception")
        raise
    except IntegrityError as e:
        # Rollback transaction for integrity errors
        db.rollback()
        print(f"[DEBUG] Transaction rolled back due to integrity error: {str(e)}")
        
        # Check if it's a unique constraint violation on email
        if "users_email_key" in str(e.orig):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A user with this email address already exists in the system. Please use a different email address."
            )
        else:
            # Other integrity errors
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unable to create tenant due to data validation error. Please check your input and try again."
            )
    except Exception as e:
        # Rollback transaction for any other errors
        db.rollback()
        print(f"[DEBUG] Transaction rolled back due to unexpected error: {str(e)}")
        import traceback
        print(f"[DEBUG] Traceback: {traceback.format_exc()}")
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while creating the tenant. Please try again or contact support if the problem persists."
        )

@router.put("/tenants/{tenant_id}", response_model=Tenant)
def update_tenant(
    *,
    db: Session = Depends(get_super_admin_db),
    _: User = Depends(require_super_admin()),
    tenant_id: UUID,
    tenant_in: TenantUpdate
) -> Any:
    """Update a tenant (super-admin only)."""
    tenant_obj = tenant_crud.get(db, id=tenant_id)
    if not tenant_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    return tenant_crud.update(db, db_obj=tenant_obj, obj_in=tenant_in)

@router.delete("/tenants/{tenant_id}", response_model=Tenant)
def delete_tenant(
    *,
    db: Session = Depends(get_super_admin_db),
    _: User = Depends(require_super_admin()),
    tenant_id: UUID
) -> Any:
    """Delete a tenant (super-admin only)."""
    tenant_obj = tenant_crud.get(db, id=tenant_id)
    if not tenant_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    return tenant_crud.remove(db, id=tenant_id)

# New endpoints for tenant settings management
@router.get("/tenants/{tenant_id}/settings", response_model=TenantSettings)
def get_tenant_settings(
    *,
    db: Session = Depends(get_super_admin_db),
    _: User = Depends(require_super_admin()),
    tenant_id: UUID
) -> Any:
    """Get settings for a specific tenant (super-admin only)."""
    settings = tenant_settings_crud.get_by_tenant_id(db, tenant_id=tenant_id)
    if not settings:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Settings not found for this tenant"
        )
    return settings

@router.post("/tenants/{tenant_id}/settings", response_model=TenantSettings, status_code=status.HTTP_201_CREATED)
def create_tenant_settings(
    *,
    db: Session = Depends(get_super_admin_db),
    _: User = Depends(require_super_admin()),
    tenant_id: UUID,
    settings_in: TenantSettingsCreate
) -> Any:
    """Create settings for a tenant (super-admin only)."""
    # Check if tenant exists
    tenant = tenant_crud.get(db, id=tenant_id)
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    # Check if settings already exist
    existing_settings = tenant_settings_crud.get_by_tenant_id(db, tenant_id=tenant_id)
    if existing_settings:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Settings already exist for this tenant"
        )
    
    # Create settings with tenant_id
    return tenant_settings_crud.create_with_tenant(db, tenant_id=tenant_id, obj_in=settings_in)

@router.put("/tenants/{tenant_id}/settings", response_model=TenantSettings)
def update_tenant_settings(
    *,
    db: Session = Depends(get_super_admin_db),
    _: User = Depends(require_super_admin()),
    tenant_id: UUID,
    settings_in: TenantSettingsUpdate
) -> Any:
    """Update settings for a tenant (super-admin only). Auto-creates if not found."""
    settings = tenant_settings_crud.get_by_tenant_id(db, tenant_id=tenant_id)
    if not settings:
        # Auto-create settings if they don't exist yet
        return tenant_settings_crud.create_or_update(db, tenant_id=tenant_id, obj_in=settings_in)
    return tenant_settings_crud.update(db, tenant_id=tenant_id, db_obj=settings, obj_in=settings_in)

# Enhanced user listing with filtering and sorting
@router.get("/users", response_model=PaginatedResponse[UserWithRoles])
async def get_all_users(
    *,
    db: Session = Depends(get_super_admin_db),
    _: UserSchema = Depends(require_super_admin()),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1),
    email: Optional[str] = None,
    is_active: Optional[bool] = None,
    tenant_id: Optional[UUID] = None,
    sort_by: str = Query("email", description="Field to sort by"),
    sort_order: str = Query("asc", description="Sort order (asc or desc)")
) -> Any:
    """Get all users across all tenants with filtering and sorting (super-admin only)."""
    # Use joinedload to eagerly load roles and their permissions
    query = db.query(User).options(
        joinedload(User.roles).joinedload(UserRoleModel.permissions),
        joinedload(User.tenant)
    )
    
    # Apply filters
    if email:
        query = query.filter(User.email.ilike(f"%{email}%"))
    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    
    if tenant_id:
        query = query.filter(User.tenant_id == tenant_id)
    
    # Get total count before pagination
    total = query.count()
    
    # Apply sorting
    if hasattr(User, sort_by):
        sort_field = getattr(User, sort_by)
        if sort_order.lower() == "desc":
            query = query.order_by(sort_field.desc())
        else:
            query = query.order_by(sort_field.asc())
    
    # Apply pagination
    users = query.offset(skip).limit(limit).all()
    
    return PaginatedResponse(
        items=users,
        total=total,
        skip=skip,
        limit=limit,
        has_next=skip + limit < total,
        has_prev=skip > 0
    )

# Enhanced reports implementation
@router.get("/reports")
def view_system_reports(
    *,
    db: Session = Depends(get_super_admin_db),
    _: User = Depends(require_super_admin()),
    report_type: str = Query(..., description="Type of report to generate"),
    start_date: Optional[datetime] = Query(None, description="Start date for report data"),
    end_date: Optional[datetime] = Query(None, description="End date for report data"),
    tenant_id: Optional[UUID] = Query(None, description="Filter by tenant ID")
) -> Any:
    """View system-wide reports (super-admin only)."""
    # Set default date range if not provided
    if not end_date:
        end_date = datetime.utcnow()
    if not start_date:
        start_date = end_date - timedelta(days=30)  # Default to last 30 days
    
    # Generate different types of reports based on report_type
    if report_type == "tenant_usage":
        # Example: Count users per tenant
        query = db.query(
            User.tenant_id,
            func.count(User.id).label("user_count")
        ).group_by(User.tenant_id)
        
        if tenant_id:
            query = query.filter(User.tenant_id == tenant_id)
        
        results = query.all()
        
        # Format results
        tenant_usage = []
        for result in results:
            tenant = tenant_crud.get(db, id=result.tenant_id)
            tenant_usage.append({
                "tenant_id": result.tenant_id,
                "tenant_name": tenant.name if tenant else "Unknown",
                "user_count": result.user_count
            })
        
        return {"report_type": "tenant_usage", "data": tenant_usage}
    
    elif report_type == "user_activity":
        # Example: User activity statistics
        active_users = db.query(User).filter(User.is_active == True).count()
        inactive_users = db.query(User).filter(User.is_active == False).count()
        recent_logins = db.query(User).filter(
            User.last_login.between(start_date, end_date)
        ).count()
        
        return {
            "report_type": "user_activity",
            "data": {
                "active_users": active_users,
                "inactive_users": inactive_users,
                "recent_logins": recent_logins,
                "period": {
                    "start_date": start_date,
                    "end_date": end_date
                }
            }
        }
    
    elif report_type == "system_health":
        # Example: System health metrics
        tenant_count = db.query(func.count(TenantModel.id)).scalar()
        
        return {
            "report_type": "system_health",
            "data": {
                "tenant_count": tenant_count,
                "database_size": "1.2 GB",  # This would be calculated dynamically in a real implementation
                "system_uptime": "99.9%"    # This would be calculated dynamically in a real implementation
            }
        }
    
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported report type: {report_type}"
        )



# Define UserCreateResponse locally if you don't want to move it to schemas
class UserCreateResponse(UserSchema):
    generated_password: Optional[str] = None

# Add these imports at the top
from src.db.crud import user_role as user_role_crud
from src.schemas.auth.user import UserUpdate

# In the create_user_cross_tenant function, around line 400-450
@router.post("/users", response_model=UserCreateResponse, status_code=status.HTTP_201_CREATED)
def create_user_cross_tenant(
    *,
    db: Session = Depends(get_db),
    user_in: UserCreateCrossTenant,
    _: UserSchema = Depends(require_super_admin()),
) -> Any:
    """Create a new user in any tenant (super-admin only)."""
    
    # Check if tenant exists
    tenant = tenant_crud.get(db, id=user_in.tenant_id)
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    # Use the tenant_id from the request body
    tenant_id = user_in.tenant_id
    user_create_data = user_in
    
    # Check if user with this email already exists globally
    existing_user = user_crud.get_by_email_any_tenant(db, email=user_in.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists in the system. Please use a different email address."
        )
    
    # Generate password if not provided
    password = user_in.password
    password_was_generated = False
    
    if not password or password == '':
        password_was_generated = True
        print(f"DEBUG: Password will be generated at CRUD level")
    
    # Create user
    try:
        user = user_crud.create(db, tenant_id=tenant_id, obj_in=user_create_data)
        print(f"DEBUG: User created with ID: {user.id}")
        
        # Get the generated password from the user object if it was generated
        generated_password = getattr(user, 'generated_password', None)
    except IntegrityError as e:
        db.rollback()
        print(f"[DEBUG] Database integrity error during user creation: {str(e)}")
        
        # Check if it's a unique constraint violation on email
        if "users_email_key" in str(e.orig):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A user with this email address already exists in the system. Please use a different email address."
            )
        else:
            # Other integrity errors
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unable to create user due to data validation error. Please check your input and try again."
            )
    except Exception as e:
        db.rollback()
        print(f"Error creating user: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while creating the user. Please try again."
        )
    
    # **ENHANCED: Automatic role assignment logic**
    if user_in.role_id:
        target_role_id = user_in.role_id
        try:
            db.execute(
                text("INSERT INTO user_role_association (user_id, role_id) VALUES (:user_id, :role_id)"),
                {"user_id": str(user.id), "role_id": str(target_role_id)}
            )
            db.commit()
        except Exception as e:
            print(f"Error assigning role: {e}")
    else:
        # **NEW: Auto-assign admin role for tenant administrators**
        # Check if this is the first user in the tenant (making them the tenant admin)
        tenant_user_count = db.query(User).filter(User.tenant_id == tenant_id).count()
        
        if tenant_user_count == 1:  # First user in tenant = tenant admin
            admin_role = user_role_crud.get_by_name(db, name="admin")
            if admin_role:
                try:
                    db.execute(
                        text("INSERT INTO user_role_association (user_id, role_id) VALUES (:user_id, :role_id)"),
                        {"user_id": str(user.id), "role_id": str(admin_role.id)}
                    )
                    db.commit()
                    print(f"Auto-assigned 'admin' role to first user in tenant: {user.email}")
                except Exception as e:
                    print(f"Error auto-assigning admin role: {e}")
    
    # Send email with login details if password was generated
    if password_was_generated and generated_password:
        try:
            send_new_user_email(user.email, user.first_name, generated_password)
        except Exception as e:
            print(f"Error sending email: {e}")
    
    # Create response with the generated password if it exists
    response = UserCreateResponse.model_validate(user, from_attributes=True)
    if password_was_generated and generated_password:
        response.generated_password = generated_password
    
    return response


@router.put("/tenants/{tenant_id}/activate", response_model=Tenant)
def activate_tenant(
    *,
    db: Session = Depends(get_super_admin_db),
    _: User = Depends(require_super_admin()),
    tenant_id: UUID
) -> Any:
    """Activate a tenant (super-admin only)."""
    print(f"Activating tenant with ID: {tenant_id}")
    tenant_obj = tenant_crud.get(db, id=tenant_id)
    if not tenant_obj:
        print(f"Tenant with ID {tenant_id} not found")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    # Update the tenant's active status
    update_data = {"is_active": True}
    print(f"Updating tenant {tenant_id} with data: {update_data}")  # Add logging
    result = tenant_crud.update(db, db_obj=tenant_obj, obj_in=update_data)
    print(f"Tenant updated: {result.is_active}")  # Add logging
    return result

@router.put("/tenants/{tenant_id}/deactivate", response_model=Tenant)
def deactivate_tenant(
    *,
    db: Session = Depends(get_super_admin_db),
    _: User = Depends(require_super_admin()),
    tenant_id: UUID
) -> Any:
    """Deactivate a tenant (super-admin only)."""
    tenant_obj = tenant_crud.get(db, id=tenant_id)
    if not tenant_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    # Update the tenant's active status
    update_data = {"is_active": False}
    return tenant_crud.update(db, db_obj=tenant_obj, obj_in=update_data)

@router.put("/users/{user_id}", response_model=UserSchema)
def update_user_cross_tenant(
    *,
    db: Session = Depends(get_super_admin_db),
    _: User = Depends(require_super_admin()),
    user_id: UUID,
    user_in: UserUpdate
) -> Any:
    """Update a user across any tenant (super-admin only)."""
    # Global user lookup
    user = user_crud.get_by_id_global(db, id=user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Update the user using their actual tenant_id
    updated_user = user_crud.update(db, tenant_id=user.tenant_id, db_obj=user, obj_in=user_in)
    return updated_user

# Add these endpoints after the existing endpoints (around line 640)

@router.get("/roles", response_model=List[UserRole])
def get_all_roles(
    *,
    db: Session = Depends(get_super_admin_db),
    _: User = Depends(require_super_admin()),
    skip: int = 0,
    limit: int = 100
) -> Any:
    """Get all roles across all tenants (super-admin only)."""
    return user_role_crud.get_multi(db, skip=skip, limit=limit)

@router.post("/roles", response_model=UserRole, status_code=status.HTTP_201_CREATED)
def create_role_cross_tenant(
    *,
    db: Session = Depends(get_super_admin_db),
    _: User = Depends(require_super_admin()),
    role_in: UserRoleCreate
) -> Any:
    """Create a new role (super-admin only)."""
    # Check if role with this name already exists
    role = user_role_crud.get_by_name(db, name=role_in.name)
    if role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role with this name already exists"
        )
    return user_role_crud.create(db, obj_in=role_in)

@router.get("/roles/{role_id}", response_model=UserRole)
def get_role(
    *,
    db: Session = Depends(get_super_admin_db),
    _: User = Depends(require_super_admin()),
    role_id: UUID
) -> Any:
    """Get a specific role (super-admin only)."""
    role = user_role_crud.get(db, id=role_id)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )
    return role

@router.get("/roles/{role_id}/permissions", response_model=List[Permission])
def get_role_permissions(
    *,
    db: Session = Depends(get_super_admin_db),
    _: User = Depends(require_super_admin()),
    role_id: UUID
) -> Any:
    """Get permissions assigned to a role (super-admin only)."""
    role = user_role_crud.get(db, id=role_id)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )
    return role.permissions

@router.post("/roles/{role_id}/permissions", response_model=UserRole)
def add_permissions_to_role(
    *,
    db: Session = Depends(get_super_admin_db),
    _: User = Depends(require_super_admin()),
    role_id: UUID,
    permission_names: List[str]
) -> Any:
    """Add permissions to a role (super-admin only)."""
    # Check if role exists
    role = user_role_crud.get(db, id=role_id)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )
    
    # Get permissions by names
    permissions = permission_crud.get_multi_by_names(db, names=permission_names)
    if len(permissions) != len(permission_names):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more permissions not found"
        )
    
    # Add permissions to role
    permission_ids = [p.id for p in permissions]
    return user_role_crud.set_permissions_to_role(db, role_id=role_id, permission_ids=permission_ids)

@router.get("/permissions", response_model=List[Permission])
def get_all_permissions(
    *,
    db: Session = Depends(get_super_admin_db),
    _: User = Depends(require_super_admin()),
    skip: int = 0,
    limit: int = 100
) -> Any:
    """Get all permissions (super-admin only)."""
    return permission_crud.get_multi(db, skip=skip, limit=limit)

@router.post("/permissions", response_model=Permission, status_code=status.HTTP_201_CREATED)
def create_permission(
    *,
    db: Session = Depends(get_super_admin_db),
    _: User = Depends(require_super_admin()),
    permission_in: PermissionCreate
) -> Any:
    """Create a new permission (super-admin only)."""
    # Check if permission with this name already exists
    permission = permission_crud.get_by_name(db, name=permission_in.name)
    if permission:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Permission with this name already exists"
        )
    return permission_crud.create(db, obj_in=permission_in)

@router.post("/users/{user_id}/roles")
def assign_roles_to_user(
    *,
    db: Session = Depends(get_super_admin_db),
    _: User = Depends(require_super_admin()),
    user_id: UUID,
    role_ids: List[UUID]
) -> Any:
    """Assign roles to a user (super-admin only)."""
    # Get user using global lookup
    user = user_crud.get_by_id_global(db, id=user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Get roles
    roles = []
    for role_id in role_ids:
        role = user_role_crud.get(db, id=role_id)
        if not role:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Role with ID {role_id} not found"
            )
        roles.append(role)
    
    # Assign roles to user
    user.roles = roles
    db.commit()
    db.refresh(user)
    
    return {"message": "Roles assigned successfully"}

@router.patch("/tenants/{tenant_id}/subscription", response_model=Tenant)
def update_tenant_subscription(
    *,
    db: Session = Depends(get_super_admin_db),
    _: User = Depends(require_super_admin()),
    tenant_id: UUID,
    subscription_in: TenantUpdate
) -> Any:
    """Update tenant subscription details (super-admin only)."""
    tenant = tenant_crud.get(db, id=tenant_id)
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    update_data = subscription_in.model_dump(exclude_unset=True)
    
    # Validate plan type if provided
    if "plan_type" in update_data and update_data["plan_type"] not in ["flat_rate", "per_user"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid plan type. Must be 'flat_rate' or 'per_user'"
        )

    return tenant_crud.update(db, db_obj=tenant, obj_in=update_data)


# ─── AI & Predictive Analytics Endpoints ─────────────────────────

@router.get("/analytics/growth-forecast")
def get_growth_forecast(
    *,
    db: Session = Depends(get_super_admin_db),
    _: User = Depends(require_super_admin()),
    history_months: int = Query(12, ge=3, le=24),
    forecast_months: int = Query(3, ge=1, le=6)
) -> Any:
    """Get growth forecast for tenants, users, and revenue."""
    from src.services.tenant.analytics_service import PredictiveAnalyticsService
    analytics = PredictiveAnalyticsService(db)
    return analytics.get_growth_forecast(history_months=history_months, forecast_months=forecast_months)


@router.get("/analytics/anomalies")
def get_anomaly_alerts(
    *,
    db: Session = Depends(get_super_admin_db),
    _: User = Depends(require_super_admin()),
) -> Any:
    """Get current anomaly alerts across all tenants."""
    from src.services.tenant.analytics_service import PredictiveAnalyticsService
    analytics = PredictiveAnalyticsService(db)
    return analytics.get_anomaly_alerts()


@router.get("/analytics/churn-risk")
def get_churn_risk(
    *,
    db: Session = Depends(get_super_admin_db),
    _: User = Depends(require_super_admin()),
) -> Any:
    """Get churn risk scores for all active tenants."""
    from src.services.tenant.analytics_service import PredictiveAnalyticsService
    analytics = PredictiveAnalyticsService(db)
    return analytics.get_churn_risk_tenants()
