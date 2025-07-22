from sqlalchemy.orm import Session
from src.db.session import SessionLocal
from src.db.crud.auth import permission as permission_crud, user_role as user_role_crud
from src.schemas.auth import PermissionCreate

def add_view_dashboard_permission():
    """Add view_dashboard permission and assign it to appropriate roles."""
    db = SessionLocal()
    
    try:
        # Create view_dashboard permission if it doesn't exist
        existing_perm = permission_crud.get_by_name(db, name="view_dashboard")
        if not existing_perm:
            perm_create = PermissionCreate(
                name="view_dashboard",
                description="Permission to view dashboard statistics"
            )
            view_dashboard_perm = permission_crud.create(db, obj_in=perm_create)
            print(f"Created permission: view_dashboard")
        else:
            view_dashboard_perm = existing_perm
            print(f"Permission already exists: view_dashboard")
        
        # Roles that should have view_dashboard permission
        roles_to_assign = ["super-admin", "admin"]
        
        for role_name in roles_to_assign:
            role = user_role_crud.get_by_name(db, name=role_name)
            if role:
                try:
                    user_role_crud.add_permissions_to_role(db, role.id, [view_dashboard_perm.id])
                    print(f"Successfully added view_dashboard permission to {role_name} role")
                except Exception as e:
                    print(f"Error adding permission to {role_name}: {e}")
            else:
                print(f"{role_name} role not found")
        
        print("\n✅ view_dashboard permission setup completed successfully!")
        
    except Exception as e:
        print(f"❌ Error during permission setup: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    add_view_dashboard_permission()