# Import all models to ensure they're registered with SQLAlchemy
from src.db.models.auth.user import User
from src.db.models.communication.notification import Notification
from src.db.models.people.student import Student
from src.db.models.academics.enrollment import Enrollment
from src.db.models.academics.grade import Grade
from src.db.models.tenant.tenant import Tenant
from src.db.models.tenant.tenant_settings import TenantSettings
from src.db.models.tenant.notification_config import TenantNotificationConfig
from src.db.models.logging.activity_log import ActivityLog
from src.db.models.logging.super_admin_activity_log import SuperAdminActivityLog
from src.db.models.academics import *
# Import other models as needed