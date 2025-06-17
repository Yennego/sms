# Import all models to ensure they're registered with SQLAlchemy
from src.db.models.auth.user import User
from src.db.models.communication.notification import Notification
# Import other models as needed