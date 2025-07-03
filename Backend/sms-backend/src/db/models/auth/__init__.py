# Import all auth models to ensure they're registered with SQLAlchemy
from src.db.models.auth.user import User
from src.db.models.auth.user_role import UserRole
from src.db.models.auth.permission import Permission
from src.db.models.auth.admin import Admin


