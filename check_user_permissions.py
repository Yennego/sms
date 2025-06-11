from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from src.core.config import settings

# Create database connection
engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

try:
    # Replace with your user's email
    user_email = "superadmin@example.com"  # Changed to match the email in assign_superadmin_role.py
    
    # Get user ID
    user_query = text("SELECT id FROM users WHERE email = :email")
    user_result = db.execute(user_query, {"email": user_email}).first()
    
    if user_result:
        user_id = user_result[0]
        print(f"User ID: {user_id}")
        
        # Get user's roles
        roles_query = text("""
            SELECT ur.id, ur.name 
            FROM user_roles ur 
            JOIN user_role_association ura ON ur.id = ura.role_id 
            WHERE ura.user_id = :user_id
        """)
        roles_result = db.execute(roles_query, {"user_id": user_id}).fetchall()
        
        print("\nUser's Roles:")
        for role in roles_result:
            print(f"  - {role.name} (ID: {role.id})")
            
            # Get permissions for this role
            perms_query = text("""
                SELECT p.id, p.name 
                FROM permissions p 
                JOIN permission_role pr ON p.id = pr.permission_id 
                WHERE pr.role_id = :role_id
            """)
            perms_result = db.execute(perms_query, {"role_id": role.id}).fetchall()
            
            print("    Permissions:")
            if perms_result:
                for perm in perms_result:
                    print(f"      - {perm.name} (ID: {perm.id})")
            else:
                print("      None")
    else:
        print(f"User with email {user_email} not found")
    
except Exception as e:
    print(f"Error: {e}")
finally:
    db.close()