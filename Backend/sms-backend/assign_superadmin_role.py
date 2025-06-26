from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from src.core.config import settings
from src.db.crud import user_role as user_role_crud

# Create database connection
engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

try:
    # Get the superadmin user
    superadmin_email = "superadmin@example.com"
    superadmin_user = db.execute(
        text("SELECT id FROM users WHERE email = :email"),
        {"email": superadmin_email}
    ).first()
    
    if not superadmin_user:
        print(f"User with email {superadmin_email} not found")
        exit(1)
    
    # Get the super-admin role
    super_admin_role = user_role_crud.get_by_name(db, name="super-admin")
    if not super_admin_role:
        print("Super-admin role not found")
        exit(1)
    
    # Check if the role is already assigned
    existing_assignment = db.execute(
        text("SELECT 1 FROM user_role_association WHERE user_id = :user_id AND role_id = :role_id"),
        {"user_id": str(superadmin_user.id), "role_id": str(super_admin_role.id)}
    ).first()
    
    if existing_assignment:
        print("Super-admin role is already assigned to this user")
    else:
        # Assign the super-admin role to the user
        db.execute(
            text("INSERT INTO user_role_association (user_id, role_id) VALUES (:user_id, :role_id)"),
            {"user_id": str(superadmin_user.id), "role_id": str(super_admin_role.id)}
        )
        db.commit()
        print(f"Successfully assigned super-admin role to user {superadmin_email}")
    
    # Verify the assignment
    verification = db.execute(
        text("""SELECT 1 FROM user_role_association ura 
               JOIN user_roles ur ON ura.role_id = ur.id 
               WHERE ura.user_id = :user_id AND ur.name = :role_name"""),
        {"user_id": str(superadmin_user.id), "role_name": "super-admin"}
    ).first()
    
    if verification:
        print("Verification successful: User has super-admin role")
    else:
        print("Verification failed: User does not have super-admin role")
        
except Exception as e:
    print(f"Error: {e}")
    db.rollback()
finally:
    db.close()