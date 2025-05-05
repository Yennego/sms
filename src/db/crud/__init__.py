from .tenant.tenant import tenant
from .tenant.tenant_settings import tenant_settings
from .auth.user import user
from .auth.permission import permission
from .auth.user_role import user_role
from .people.student import student
from .people.teacher import teacher
from .people.parent import parent

__all__ = [
    "tenant",
    "tenant_settings",
    "user",
    "permission",
    "user_role",
    "student",
    "teacher",
    "parent"
]