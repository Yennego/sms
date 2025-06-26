from sqlalchemy import create_engine, text
from src.core.config import settings
from uuid import UUID

# Create engine
engine = create_engine(settings.DATABASE_URL)

# The IDs from find_ids.py need to be formatted as proper UUIDs
user_id_str = "7894beb3ac634394991bfcf2b142f5b8"
role_id_str = "dc831a2b90ba447386ad160aafbfa2dc"

# Convert to proper UUID format
try:
    # Format the strings as proper UUIDs
    user_id = str(UUID(user_id_str))
    role_id = str(UUID(role_id_str))
    
    # SQL query to insert the association
    insert_query = f"""
    INSERT INTO user_role_association (user_id, role_id) 
    VALUES ('{user_id}', '{role_id}');
    """
    
    with engine.connect() as connection:
        try:
            connection.execute(text(insert_query))
            connection.commit()
            print(f"Role assigned successfully! User ID: {user_id}, Role ID: {role_id}")
        except Exception as e:
            print(f"Error assigning role: {e}")
            
            # Check if the association already exists
            check_query = f"""
            SELECT * FROM user_role_association 
            WHERE user_id = '{user_id}' AND role_id = '{role_id}';
            """
            result = connection.execute(text(check_query))
            if result.fetchone():
                print("Note: This role association already exists in the database.")
            
except ValueError as e:
    print(f"Error formatting UUIDs: {e}")