from sqlalchemy import create_engine, text
from src.core.config import settings
from uuid import UUID
import sys

# Create engine
engine = create_engine(settings.DATABASE_URL)

def check_current_state():
    """Check current users and their role assignments"""
    with engine.connect() as connection:
        print("=== CURRENT DATABASE STATE ===")
        
        # Check all users
        print("\n1. All Users:")
        users_query = """
        SELECT id, email, first_name, last_name, is_active, tenant_id 
        FROM users 
        ORDER BY email;
        """
        try:
            result = connection.execute(text(users_query))
            users = result.fetchall()
            for user in users:
                print(f"  - {user.email} ({user.first_name} {user.last_name}) - ID: {user.id}")
        except Exception as e:
            print(f"Error fetching users: {e}")
        
        # Check all roles
        print("\n2. All Roles:")
        roles_query = """
        SELECT id, name, display_name 
        FROM user_roles 
        ORDER BY name;
        """
        try:
            result = connection.execute(text(roles_query))
            roles = result.fetchall()
            for role in roles:
                print(f"  - {role.name} ({role.display_name}) - ID: {role.id}")
        except Exception as e:
            print(f"Error fetching roles: {e}")
        
        # Check user-role associations
        print("\n3. Current User-Role Associations:")
        associations_query = """
        SELECT u.email, u.first_name, u.last_name, r.name as role_name
        FROM users u
        LEFT JOIN user_role_association ura ON u.id = ura.user_id
        LEFT JOIN user_roles r ON ura.role_id = r.id
        ORDER BY u.email;
        """
        try:
            result = connection.execute(text(associations_query))
            associations = result.fetchall()
            for assoc in associations:
                role_display = assoc.role_name if assoc.role_name else "NO ROLE"
                print(f"  - {assoc.email} ({assoc.first_name} {assoc.last_name}) -> {role_display}")
        except Exception as e:
            print(f"Error fetching associations: {e}")

def assign_admin_roles():
    """Assign admin roles to users who don't have roles"""
    with engine.connect() as connection:
        print("\n=== ASSIGNING ROLES ===")
        
        # Get admin role ID
        admin_role_query = "SELECT id FROM user_roles WHERE name = 'admin';"
        try:
            result = connection.execute(text(admin_role_query))
            admin_role = result.fetchone()
            if not admin_role:
                print("ERROR: Admin role not found! Please create the admin role first.")
                return
            admin_role_id = admin_role.id
            print(f"Admin role ID: {admin_role_id}")
        except Exception as e:
            print(f"Error getting admin role: {e}")
            return
        
        # Get users without roles (excluding super-admin)
        users_without_roles_query = """
        SELECT u.id, u.email, u.first_name, u.last_name
        FROM users u
        LEFT JOIN user_role_association ura ON u.id = ura.user_id
        WHERE ura.user_id IS NULL AND u.email != 'superadmin@example.com'
        ORDER BY u.email;
        """
        
        try:
            result = connection.execute(text(users_without_roles_query))
            users_without_roles = result.fetchall()
            
            if not users_without_roles:
                print("All users already have roles assigned.")
                return
            
            print(f"\nFound {len(users_without_roles)} users without roles:")
            for user in users_without_roles:
                print(f"  - {user.email} ({user.first_name} {user.last_name})")
            
            # Assign admin role to each user
            for user in users_without_roles:
                try:
                    insert_query = """
                    INSERT INTO user_role_association (user_id, role_id) 
                    VALUES (:user_id, :role_id);
                    """
                    connection.execute(text(insert_query), {
                        "user_id": str(user.id),
                        "role_id": str(admin_role_id)
                    })
                    print(f"  ✓ Assigned admin role to {user.email}")
                except Exception as e:
                    print(f"  ✗ Error assigning role to {user.email}: {e}")
            
            connection.commit()
            print("\nRole assignment completed!")
            
        except Exception as e:
            print(f"Error in role assignment: {e}")
            connection.rollback()

def verify_assignments():
    """Verify that all users now have roles"""
    with engine.connect() as connection:
        print("\n=== VERIFICATION ===")
        
        verification_query = """
        SELECT u.email, u.first_name, u.last_name, 
               COALESCE(r.name, 'NO ROLE') as role_name
        FROM users u
        LEFT JOIN user_role_association ura ON u.id = ura.user_id
        LEFT JOIN user_roles r ON ura.role_id = r.id
        ORDER BY u.email;
        """
        
        try:
            result = connection.execute(text(verification_query))
            users = result.fetchall()
            
            print("\nFinal user-role assignments:")
            users_without_roles = 0
            for user in users:
                status = "✓" if user.role_name != "NO ROLE" else "✗"
                print(f"  {status} {user.email} ({user.first_name} {user.last_name}) -> {user.role_name}")
                if user.role_name == "NO ROLE":
                    users_without_roles += 1
            
            if users_without_roles == 0:
                print("\n🎉 SUCCESS: All users now have roles assigned!")
            else:
                print(f"\n⚠️  WARNING: {users_without_roles} users still don't have roles.")
                
        except Exception as e:
            print(f"Error in verification: {e}")

if __name__ == "__main__":
    print("User Role Assignment Checker and Fixer")
    print("======================================")
    
    # Step 1: Check current state
    check_current_state()
    
    # Step 2: Ask user if they want to assign roles
    print("\n" + "="*50)
    response = input("\nDo you want to assign admin roles to users without roles? (y/n): ")
    
    if response.lower() in ['y', 'yes']:
        assign_admin_roles()
        verify_assignments()
    else:
        print("Skipping role assignment.")
    
    print("\nDone!")