from sqlalchemy import create_engine, text
from src.core.config import settings

# Create engine
engine = create_engine(settings.DATABASE_URL)

# Find user ID
user_query = "SELECT id FROM users WHERE email = 'superadmin@example.com';"

# Find role ID
role_query = "SELECT id FROM user_roles WHERE name = 'super-admin';"

with engine.connect() as connection:
    # Get user ID
    user_result = connection.execute(text(user_query))
    user_id = user_result.fetchone()
    print(f"User ID: {user_id[0] if user_id else 'Not found'}")
    
    # Get role ID
    role_result = connection.execute(text(role_query))
    role_id = role_result.fetchone()
    print(f"Role ID: {role_id[0] if role_id else 'Not found'}")