from typing import Any, List, Optional, Dict
from uuid import UUID
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy import text

from src.db.crud import tenant as tenant_crud
from src.db.crud import tenant_settings as tenant_settings_crud
from src.db.crud import user as user_crud
from src.db.session import get_super_admin_db
from src.schemas.tenant import Tenant, TenantCreate, TenantUpdate
from src.schemas.tenant import TenantSettings, TenantSettingsCreate, TenantSettingsUpdate
from src.schemas.auth import User as UserSchema  # Rename to avoid confusion
from src.db.models.auth.user import User  # Import the SQLAlchemy model
from src.core.security.permissions import require_super_admin
from src.schemas.auth.user import UserWithRoles
from src.db.models.auth.user_role import UserRole
from sqlalchemy.orm import joinedload

router = APIRouter()

@router.get("/tenants", response_model=List[Tenant])
def get_all_tenants(
    *,
    db: Session = Depends(get_super_admin_db),
    _: User = Depends(require_super_admin()),
    skip: int = 0,
    limit: int = 100
) -> Any:
    """Get all tenants (super-admin only)."""
    return tenant_crud.get_multi(db, skip=skip, limit=limit)

@router.post("/tenants", response_model=Tenant, status_code=status.HTTP_201_CREATED)
def create_tenant(
    *,
    db: Session = Depends(get_super_admin_db),
    _: User = Depends(require_super_admin()),
    tenant_in: TenantCreate
) -> Any:
    """Create a new tenant (super-admin only)."""
    tenant_obj = tenant_crud.get_by_code(db, code=tenant_in.code)
    if tenant_obj:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant with this code already exists"
        )
    return tenant_crud.create(db, obj_in=tenant_in)

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
    """Update settings for a tenant (super-admin only)."""
    settings = tenant_settings_crud.get_by_tenant_id(db, tenant_id=tenant_id)
    if not settings:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Settings not found for this tenant"
        )
    return tenant_settings_crud.update(db, db_obj=settings, obj_in=settings_in)

# Enhanced user listing with filtering and sorting
@router.get("/users", response_model=List[UserWithRoles])
async def get_all_users(
    *,
    db: Session = Depends(get_super_admin_db),
    _: UserSchema = Depends(require_super_admin()),
    skip: int = 0,
    limit: int = 100,
    email: Optional[str] = None,
    is_active: Optional[bool] = None,
    tenant_id: Optional[UUID] = None,
    sort_by: str = Query("email", description="Field to sort by"),
    sort_order: str = Query("asc", description="Sort order (asc or desc)")
) -> Any:
    """Get all users across all tenants with filtering and sorting (super-admin only)."""
    # Use joinedload to eagerly load roles and their permissions
    query = db.query(User).options(
        joinedload(User.roles).joinedload(UserRole.permissions)
    )
    
    # Apply filters
    if email:
        query = query.filter(User.email.ilike(f"%{email}%"))
    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    
    # Add this helper function at the top of the file if not already present
    def _ensure_uuid(value: Any) -> UUID:
        """Ensure the value is a UUID object."""
        if isinstance(value, str):
            return UUID(value)
        return value
    
    # Then use it before any tenant_id filter
    if tenant_id:
        tenant_id = _ensure_uuid(tenant_id)
        query = query.filter(User.tenant_id == tenant_id)
    
    # Apply sorting
    if hasattr(User, sort_by):
        sort_field = getattr(User, sort_by)
        if sort_order.lower() == "desc":
            query = query.order_by(sort_field.desc())
        else:
            query = query.order_by(sort_field.asc())
    
    # Apply pagination and return results
    return query.offset(skip).limit(limit).all()

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
        tenant_count = db.query(func.count(Tenant.id)).scalar()
        
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

# At the top with other imports
from src.db.crud import user as user_crud
from src.schemas.auth import UserCreate
from src.api.v1.endpoints.auth.auth import UserCreateResponse
from src.services.auth.password import generate_default_password
from src.services.email import send_new_user_email

# Define UserCreateResponse locally if you don't want to move it to schemas
class UserCreateResponse(UserSchema):
    generated_password: Optional[str] = None

# Add this new endpoint for cross-tenant user creation
@router.post("/users", response_model=UserCreateResponse, status_code=status.HTTP_201_CREATED)
def create_user_cross_tenant(
    *,
    db: Session = Depends(get_super_admin_db),
    _: UserSchema = Depends(require_super_admin()),  # Use UserSchema instead of User
    user_in: UserCreate,
    tenant_id: UUID = Query(..., description="The tenant ID to create the user in"),
    role_id: Optional[UUID] = Query(None, description="Role ID to assign to the user")
) -> Any:
    """Create a new user in any tenant (super-admin only)."""
    # Check if tenant exists
    tenant = tenant_crud.get(db, id=tenant_id)
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    # Override the tenant_id in user_in with the one from query parameter
    # This ensures we use the query parameter tenant_id regardless of what's in the body
    user_in_dict = user_in.model_dump()
    user_in_dict["tenant_id"] = tenant_id
    
    # Check if user with this email already exists
    user = user_crud.get_by_email(db, tenant_id=tenant_id, email=user_in.email)
    if user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists"
        )
    
    # Generate password if not provided
    password = user_in.password
    password_was_generated = False
    if not password:
        password = generate_default_password()
        password_was_generated = True
        # Set the password in the user_in object
        user_in.password = password
        
    # Create user
    user = user_crud.create(db, tenant_id=tenant_id, obj_in=user_in)
    
    # Assign role if provided
    if role_id:
        try:
            # Insert into user_role_association table
            db.execute(
                text("INSERT INTO user_role_association (user_id, role_id) VALUES (:user_id, :role_id)"),
                {"user_id": str(user.id), "role_id": str(role_id)}
            )
            db.commit()
        except Exception as e:
            # Log the error but don't fail the request
            print(f"Error assigning role: {e}")
            # Check if it's a duplicate role assignment
            try:
                result = db.execute(
                    text("SELECT 1 FROM user_role_association WHERE user_id = :user_id AND role_id = :role_id"),
                    {"user_id": str(user.id), "role_id": str(role_id)}
                )
                if result.fetchone():
                    print("Role association already exists")
            except Exception:
                pass
    
    # Send email with login details if password was generated
    if password_was_generated:
        send_new_user_email(user.email, user.first_name, password)
    
    # Create response with the generated password if it exists
    response = UserCreateResponse.model_validate(user, from_attributes=True)
    if password_was_generated:
        response.generated_password = password
    
    return response