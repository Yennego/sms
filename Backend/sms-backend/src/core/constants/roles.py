"""
Role constants for the application.
"""

# User role constants
ROLE_SUPER_ADMIN = "super_admin"
ROLE_TENANT_ADMIN = "tenant_admin"
ROLE_TEACHER = "teacher"
ROLE_STUDENT = "student"
ROLE_PARENT = "parent"
ROLE_STAFF = "staff"

# Role groups
ADMIN_ROLES = [ROLE_SUPER_ADMIN, ROLE_TENANT_ADMIN]
STAFF_ROLES = [ROLE_TEACHER, ROLE_STAFF]
USER_ROLES = [ROLE_STUDENT, ROLE_PARENT]
ALL_ROLES = ADMIN_ROLES + STAFF_ROLES + USER_ROLES

# Default role assignments
DEFAULT_STUDENT_ROLES = [ROLE_STUDENT]
DEFAULT_TEACHER_ROLES = [ROLE_TEACHER]
DEFAULT_PARENT_ROLES = [ROLE_PARENT]