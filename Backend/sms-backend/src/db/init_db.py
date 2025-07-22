from src.db.models.auth import User

# Add this to your init_db.py file or create it if it doesn't exist

from src.db.crud import user_role as user_role_crud
from src.db.crud import permission as permission_crud
from src.db.crud import user as user_crud
from src.schemas.auth import UserRoleCreate, PermissionCreate, UserCreate
from uuid import uuid4

def init_db(db):
    # Create super-admin role if it doesn't exist
    super_admin_role = user_role_crud.get_by_name(db, name="superadmin")
    if not super_admin_role:
        super_admin_role = user_role_crud.create(
            db,
            obj_in=UserRoleCreate(
                name="superadmin",
                description="Super administrator with cross-tenant privileges"
            )
        )
    
    # Create necessary permissions
    permissions = [
        "manage_tenants",
        "view_all_users",
        "view_system_reports"
    ]
    
    for perm_name in permissions:
        perm = permission_crud.get_by_name(db, name=perm_name)
        if not perm:
            perm = permission_crud.create(
                db,
                obj_in=PermissionCreate(
                    name=perm_name,
                    description=f"Permission to {perm_name.replace('_', ' ')}"
                )
            )
            # Add permission to super-admin role
            user_role_crud.add_permissions_to_role(db, super_admin_role.id, [perm.id])
    
    # Create a default super-admin user if it doesn't exist
    super_admin_email = "superadmin@example.com"
    
    # Check if user exists with this email across ANY tenant
    existing_user = db.query(User).filter(User.email == super_admin_email).first()
    
    if not existing_user:
        # Create a system tenant for super-admin if needed
        system_tenant_id = uuid4()
        
        # Create super-admin user
        super_admin_user = user_crud.create(
            db,
            tenant_id=system_tenant_id,
            obj_in=UserCreate(
                email=super_admin_email,
                password="superadmin123",  # In production, use a secure password
                first_name="Super",
                last_name="Admin",
                is_active=True,
                tenant_id=system_tenant_id
            )
        )
        print(f"Created super-admin with tenant_id: {system_tenant_id}")
    else:
        print(f"Super-admin exists with tenant_id: {existing_user.tenant_id}")
        super_admin_user = existing_user
    
    # Create a test tenant and user
    test_tenant_id = uuid4()
    test_user_email = "test@example.com"
    
    # Check if user exists with this email across ANY tenant
    existing_test_user = db.query(User).filter(User.email == test_user_email).first()
    
    if not existing_test_user:
        user_crud.create(
            db,
            tenant_id=test_tenant_id,
            obj_in=UserCreate(
                email=test_user_email,
                password="password123",  # In production, use a secure password
                first_name="Test",
                last_name="User",
                is_active=True,
                tenant_id=test_tenant_id
            )
        )
        print(f"Created test user with tenant ID: {test_tenant_id}")