from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from src.core.config import settings
from src.db.crud import permission as permission_crud
from src.db.crud import user_role as user_role_crud
from src.schemas.auth import PermissionCreate

# Create database connection
engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

# Define new permissions
exam_permissions = [
    {"name": "create_exam", "description": "Permission to create exams"},
    {"name": "view_exam", "description": "Permission to view exams"},
    {"name": "update_exam", "description": "Permission to update exams"},
    {"name": "delete_exam", "description": "Permission to delete exams"},
    {"name": "publish_exam", "description": "Permission to publish exams"},
    {"name": "view_all_exams", "description": "Permission to view all exams across tenants (super-admin)"},
]

notification_permissions = [
    {"name": "send_notification", "description": "Permission to send notifications"},
    {"name": "view_notification", "description": "Permission to view notifications"},
    {"name": "view_all_notifications", "description": "Permission to view all notifications across tenants (super-admin)"},
]

audit_logging_permissions = [
    {"name": "view_audit_logs", "description": "Permission to view audit logs"},
    {"name": "view_all_audit_logs", "description": "Permission to view all audit logs across tenants (super-admin)"},
    {"name": "generate_activity_reports", "description": "Permission to generate activity reports (super-admin)"},
]

try:
    # Get the super-admin role to add all permissions to it
    super_admin_role = user_role_crud.get_by_name(db, name="super-admin")
    if not super_admin_role:
        print("Super-admin role not found")
        exit(1)
    
    # Get the admin role to add tenant-specific permissions
    admin_role = user_role_crud.get_by_name(db, name="admin")
    if not admin_role:
        print("Admin role not found")
        exit(1)
    
    # Get the teacher role for exam-related permissions
    teacher_role = user_role_crud.get_by_name(db, name="teacher")
    if not teacher_role:
        print("Teacher role not found")
        exit(1)
    
    # Create all permissions and store their IDs
    all_permissions = exam_permissions + notification_permissions + audit_logging_permissions
    permission_ids = {}
    
    for perm_data in all_permissions:
        perm = permission_crud.get_by_name(db, name=perm_data["name"])
        if not perm:
            perm = permission_crud.create(
                db,
                obj_in=PermissionCreate(
                    name=perm_data["name"],
                    description=perm_data["description"]
                )
            )
        permission_ids[perm.name] = perm.id
    
    # Add ALL permissions to super-admin role
    all_perm_ids = [permission_ids[p["name"]] for p in all_permissions]
    user_role_crud.add_permissions_to_role(db, super_admin_role.id, all_perm_ids)
    
    # Add tenant-specific permissions to admin role
    admin_perm_names = [
        "create_exam", "view_exam", "update_exam", "delete_exam", "publish_exam",
        "send_notification", "view_notification",
        "view_audit_logs"
    ]
    admin_perm_ids = [permission_ids[name] for name in admin_perm_names if name in permission_ids]
    user_role_crud.add_permissions_to_role(db, admin_role.id, admin_perm_ids)
    
    # Add exam-related permissions to teacher role
    teacher_perm_names = ["create_exam", "view_exam", "update_exam", "publish_exam"]
    teacher_perm_ids = [permission_ids[name] for name in teacher_perm_names if name in permission_ids]
    user_role_crud.add_permissions_to_role(db, teacher_role.id, teacher_perm_ids)
    
    print("Successfully created RBAC permissions for Exam, Notification, and Audit Logging services")
    
except Exception as e:
    print(f"Error: {e}")
finally:
    db.close()