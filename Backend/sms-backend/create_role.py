from sqlalchemy import create_engine, text
from src.core.config import settings
import uuid

# Create engine
engine = create_engine(settings.DATABASE_URL)

# Create super-admin role if it doesn't exist
role_id = "dc831a2b-90ba-4473-86ad-160aafbfa2dc"
role_name = "super-admin"
role_description = "Super administrator with full system access"

# Check if role exists
check_query = f"SELECT id FROM user_roles WHERE name = '{role_name}';"

with engine.connect() as connection:
    result = connection.execute(text(check_query))
    existing_role = result.fetchone()
    
    if existing_role:
        print(f"Role '{role_name}' already exists with ID: {existing_role[0]}")
    else:
        # Create the role
        insert_query = f"""
        INSERT INTO user_roles (id, name, description) 
        VALUES ('{role_id}', '{role_name}', '{role_description}');
        """
        
        try:
            connection.execute(text(insert_query))
            connection.commit()
            print(f"Created '{role_name}' role with ID: {role_id}")
        except Exception as e:
            print(f"Error creating role: {e}")