from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from src.core.config import settings
from src.db.crud import permission as permission_crud
from src.db.crud import user_role as user_role_crud
from src.schemas.auth import PermissionCreate

# Create database connection
engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

try:
    # Get the super-admin role
    super_admin_role = user_role_crud.get_by_name(db, name="super-admin")
    if not super_admin_role:
        print("Super-admin role not found")
        exit(1)
    
    # Create or get the manage_roles permission
    manage_roles_perm = permission_crud.get_by_name(db, name="manage_roles")
    if not manage_roles_perm:
        manage_roles_perm = permission_crud.create(
            db,
            obj_in=PermissionCreate(
                name="manage_roles",
                description="Permission to manage roles"
            )
        )
    
    # Add permission to super-admin role
    user_role_crud.add_permissions_to_role(db, super_admin_role.id, [manage_roles_perm.id])
    print("Successfully added manage_roles permission to super-admin role")
    
except Exception as e:
    print(f"Error: {e}")
finally:
    db.close()