import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from src.db.session import SessionLocal
from src.db.crud import user_role as user_role_crud
from src.db.crud import user as user_crud
from src.schemas.auth import UserRoleCreate
from src.db.models.auth import User, UserRole
from sqlalchemy import text

def fix_tenant_admin_roles():
    db: Session = SessionLocal()
    try:
        print("=== Checking Current Role Setup ===")
        
        # Check what roles exist
        roles = db.query(UserRole).all()
        print("\nExisting roles:")
        for role in roles:
            print(f"- {role.name} (ID: {role.id})")
        
        # Check if 'admin' role exists
        admin_role = user_role_crud.get_by_name(db, name="admin")
        if not admin_role:
            print("\n'admin' role not found. Creating it...")
            admin_role = user_role_crud.create(
                db,
                obj_in=UserRoleCreate(
                    name="admin",
                    description="Tenant administrator with full tenant privileges"
                )
            )
            print(f"Created 'admin' role with ID: {admin_role.id}")
        else:
            print(f"\n'admin' role exists with ID: {admin_role.id}")
        
        # Check paul's current role
        paul_user = db.query(User).filter(User.email == "paul@topfoundation.com").first()
        if paul_user:
            print(f"\n=== Paul's Current Status ===")
            print(f"User ID: {paul_user.id}")
            print(f"Email: {paul_user.email}")
            print(f"Tenant ID: {paul_user.tenant_id}")
            
            # Check current roles
            current_roles = paul_user.roles
            print(f"Current roles: {[role.name for role in current_roles]}")
            
            # Assign admin role if not present
            has_admin = any(role.name == "admin" for role in current_roles)
            if not has_admin:
                print("\nAssigning 'admin' role to Paul...")
                # Add role association
                db.execute(
                    text("INSERT INTO user_role_association (user_id, role_id) VALUES (:user_id, :role_id)"),
                    {"user_id": str(paul_user.id), "role_id": str(admin_role.id)}
                )
                db.commit()
                print("✅ Successfully assigned 'admin' role to Paul")
            else:
                print("✅ Paul already has 'admin' role")
        else:
            print("\n❌ Paul user not found")
        
        print("\n=== Role Assignment Fix Complete ===")
        
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    fix_tenant_admin_roles()