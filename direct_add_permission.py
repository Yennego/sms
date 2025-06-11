from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from src.core.config import settings

# Create database connection
engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

try:
    # First, ensure the permission exists
    permission_query = text("""INSERT INTO permissions (id, name, description, created_at, updated_at) 
                           VALUES (gen_random_uuid(), 'manage_roles', 'Permission to manage roles', NOW(), NOW())
                           ON CONFLICT (name) DO NOTHING RETURNING id;""")
    permission_result = db.execute(permission_query)
    db.commit()
    
    # Get the permission ID
    permission_id_query = text("SELECT id FROM permissions WHERE name = 'manage_roles'")
    permission_id_result = db.execute(permission_id_query).first()
    
    if permission_id_result:
        permission_id = permission_id_result[0]
        
        # Get the super-admin role ID
        role_id_query = text("SELECT id FROM user_roles WHERE name = 'super-admin'")
        role_id_result = db.execute(role_id_query).first()
        
        if role_id_result:
            role_id = role_id_result[0]
            
            # Add the permission to the role
            association_query = text("""INSERT INTO permission_role (permission_id, role_id) 
                                    VALUES (:permission_id, :role_id) 
                                    ON CONFLICT DO NOTHING;""")
            db.execute(association_query, {"permission_id": permission_id, "role_id": role_id})
            db.commit()
            print(f"Successfully added manage_roles permission to super-admin role")
        else:
            print("Super-admin role not found")
    else:
        print("manage_roles permission not found")
    
except Exception as e:
    print(f"Error: {e}")
    db.rollback()
finally:
    db.close()