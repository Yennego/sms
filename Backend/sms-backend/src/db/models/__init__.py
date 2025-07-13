# Import all models to ensure they're registered with SQLAlchemy
from src.db.models.auth.user import User
from src.db.models.communication.notification import Notification
from src.db.models.people.student import Student
from src.db.models.academics.enrollment import Enrollment
from src.db.models.academics.grade import Grade  
# Import other models as needed