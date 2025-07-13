import asyncio
from sqlalchemy.orm import Session
from src.db.session import SessionLocal
from src.db.crud.auth import permission as permission_crud, user_role as user_role_crud
from src.schemas.auth import PermissionCreate, UserRoleCreate

def setup_complete_rbac():
    """Set up complete role-based access control with all roles and permissions."""
    db = SessionLocal()
    
    try:
        # Define all permissions
        all_permissions = [
            # User Management
            "manage_tenants", "view_all_users", "view_users", "create_users", "update_users", "manage_users",
            
            # System & Reports
            "view_system_reports", "manage_roles",
            
            # Audit & Logging
            "view_audit_logs", "view_all_audit_logs", "generate_activity_reports",
            
            # Tenant Management
            "view_tenant_data", "manage_tenant_settings",
            
            # Academic Management
            "view_academic_data", "manage_academic_data", "generate_academic_reports",
            "view_student_records", "manage_student_records", "manage_enrollment",
            "promote_students", "manage_academic_year",
            
            # Financial Management
            "view_financial_data", "manage_financial_data", "approve_financial_transactions",
            "generate_financial_reports", "create_invoices", "record_payments",
            "manage_budgets", "view_budget_reports", "issue_refunds", "view_payment_history",
            
            # Classroom & Teaching
            "manage_classroom_data", "submit_grades", "manage_attendance",
            
            # Student & Parent
            "view_own_records", "view_own_schedule", "submit_assignments", "view_own_financial_data",
            "view_child_records", "view_child_financial_data",
            
            # Counseling
            "manage_counseling_notes",
            
            # Communication
            "send_notifications", "view_notifications"
        ]
        
        # Create all permissions
        print("Creating permissions...")
        created_permissions = {}
        for perm_name in all_permissions:
            existing_perm = permission_crud.get_by_name(db, name=perm_name)
            if not existing_perm:
                perm_create = PermissionCreate(
                    name=perm_name,
                    description=f"Permission to {perm_name.replace('_', ' ')}"
                )
                created_perm = permission_crud.create(db, obj_in=perm_create)
                created_permissions[perm_name] = created_perm
                print(f"  Created permission: {perm_name}")
            else:
                created_permissions[perm_name] = existing_perm
                print(f"  Permission already exists: {perm_name}")
        
        # Define role-permission mapping
        role_permissions = {
            "super-admin": [
                "manage_tenants", "view_all_users", "view_system_reports", "manage_roles",
                "create_users", "update_users", "manage_users", "view_all_audit_logs",
                "view_financial_data", "generate_financial_reports", "generate_activity_reports"
            ],
            "admin": [
                "view_users", "create_users", "update_users", "manage_users", "view_tenant_data",
                "manage_tenant_settings", "view_academic_data", "manage_academic_data",
                "generate_academic_reports", "view_student_records", "manage_student_records",
                "manage_enrollment", "promote_students", "manage_academic_year",
                "view_financial_data", "generate_financial_reports", "view_budget_reports",
                "view_payment_history", "send_notifications", "view_notifications", "view_audit_logs"
            ],
            "financial-admin": [
                "view_financial_data", "manage_financial_data", "approve_financial_transactions",
                "generate_financial_reports", "create_invoices", "record_payments",
                "manage_budgets", "view_budget_reports", "issue_refunds", "view_payment_history",
                "send_notifications", "view_notifications"
            ],
            "academic-admin": [
                "view_academic_data", "manage_academic_data", "generate_academic_reports",
                "view_student_records", "manage_student_records", "manage_enrollment",
                "promote_students", "view_notifications", "send_notifications"
            ],
            "registrar": [
                "view_student_records", "manage_student_records", "manage_enrollment",
                "promote_students", "view_academic_data", "view_notifications", "send_notifications"
            ],
            "teacher": [
                "view_student_records", "manage_classroom_data", "submit_grades",
                "manage_attendance", "send_notifications", "view_notifications"
            ],
            "student": [
                "view_own_records", "view_own_schedule", "submit_assignments",
                "view_own_financial_data", "view_payment_history", "view_notifications"
            ],
            "parent": [
                "view_child_records", "view_child_financial_data", "view_own_schedule",
                "view_payment_history", "view_notifications"
            ],
            "counselor": [
                "view_student_records", "manage_counseling_notes", "view_academic_data",
                "send_notifications", "view_notifications"
            ],
            "accountant": [
                "view_financial_data", "manage_financial_data", "create_invoices",
                "record_payments", "view_payment_history", "view_budget_reports",
                "view_notifications", "send_notifications"
            ]
        }
        
        # Create roles and assign permissions
        print("\nCreating roles and assigning permissions...")
        for role_name, permission_names in role_permissions.items():
            # Check if role exists
            existing_role = user_role_crud.get_by_name(db, name=role_name)
            if not existing_role:
                role_create = UserRoleCreate(
                    name=role_name,
                    description=f"{role_name.replace('-', ' ').title()} role"
                )
                role = user_role_crud.create(db, obj_in=role_create)
                print(f"  Created role: {role_name}")
            else:
                role = existing_role
                print(f"  Role already exists: {role_name}")
            
            # Get permission IDs for this role
            permission_ids = []
            for perm_name in permission_names:
                if perm_name in created_permissions:
                    permission_ids.append(created_permissions[perm_name].id)
                else:
                    print(f"    Warning: Permission '{perm_name}' not found for role '{role_name}'")
            
            # Assign permissions to role
            if permission_ids:
                try:
                    user_role_crud.add_permissions_to_role(db, role_id=role.id, permission_ids=permission_ids)
                    print(f"    Assigned {len(permission_ids)} permissions to {role_name}")
                except Exception as e:
                    print(f"    Error assigning permissions to {role_name}: {e}")
        
        print("\n✅ Complete RBAC setup completed successfully!")
        print("\nRoles created:")
        for role_name in role_permissions.keys():
            print(f"  - {role_name}")
        
        print(f"\nTotal permissions created: {len(all_permissions)}")
        
    except Exception as e:
        print(f"❌ Error during RBAC setup: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    setup_complete_rbac()