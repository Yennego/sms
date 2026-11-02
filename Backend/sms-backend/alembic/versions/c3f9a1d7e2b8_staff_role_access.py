"""
staff_role_access

Each built-in staff role gets the permissions its job needs (docs/guides/user-guide.md §1 "Who
uses it" and §4). The academics, students and attendance endpoints now check permissions instead
of the admin role name; teachers, students and parents keep their role-based access unchanged.

1. Two new permissions, so whole-school attendance is not confused with a teacher's own class
   (teachers already hold view_attendance and manage_attendance):
   - view_school_attendance: read every class's attendance (today's overview, class reports,
     a student's record);
   - manage_school_attendance: run attendance for the whole school (mark any class, excuses,
     the school calendar, rules, ID cards, closing the day).
2. Grants (built-in roles only):
   - admin: both new permissions (it already holds everything else used here);
   - academic-admin (principal): students (read, admit, edit), teachers (read, add), classes,
     sections, grade levels, timetables, subjects, the school year (setup, promotion,
     graduation), teacher assignments, and reading attendance;
   - registrar: students (read, admit, edit), classes, sections, grade levels, timetables, reading
     subjects, and reading attendance;
   - counselor: reading students and their attendance; accountant, financial-admin: reading students.

Downgrade takes back what this migration granted and drops the two new permissions.

Revision ID: c3f9a1d7e2b8
Revises: b8d4f0a2c3e5
Create Date: 2026-11-02 22:00:00.000000

"""
import uuid

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'c3f9a1d7e2b8'
down_revision = 'b8d4f0a2c3e5'
branch_labels = None
depends_on = None

TAG = "[staff_role_access]"
NEW_PERMISSIONS = {
    "view_school_attendance": "Read every class's attendance",
    "manage_school_attendance": "Run attendance for the whole school",
}
GRANTS = {
    "admin": ["view_school_attendance", "manage_school_attendance"],
    "academic-admin": [
        "view_students", "manage_students", "view_teachers", "manage_teachers",
        "view_classes", "manage_classes", "view_subjects", "manage_subjects",
        "manage_academic_year", "manage_teacher_assignments", "view_school_attendance",
    ],
    "registrar": [
        "view_students", "manage_students", "view_teachers", "view_classes", "manage_classes", "view_subjects",
        "view_school_attendance",
    ],
    # Counselors follow students' attendance as part of their work
    "counselor": ["view_students", "view_school_attendance"],
    "accountant": ["view_students"],
    "financial-admin": ["view_students"],
}


def upgrade() -> None:
    bind = op.get_bind()
    names = sorted({p for perms in GRANTS.values() for p in perms})
    for name in names:
        bind.execute(sa.text("""
            INSERT INTO permissions (id, name, description, created_at, updated_at)
            SELECT :id, :name, :description, now(), now()
            WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = :name)
        """), {"id": uuid.uuid4(), "name": name, "description": NEW_PERMISSIONS.get(name, name)})
    for role, perms in GRANTS.items():
        granted = bind.execute(sa.text("""
            INSERT INTO permission_role (permission_id, role_id)
            SELECT p.id, r.id FROM permissions p, user_roles r
            WHERE p.name = ANY(:names) AND r.name = :role AND r.tenant_id IS NULL
            ON CONFLICT DO NOTHING
        """), {"names": perms, "role": role}).rowcount
        print(f"{TAG} {role}: {granted} new")


def downgrade() -> None:
    bind = op.get_bind()
    for role, perms in GRANTS.items():
        if role == "admin":
            continue  # only the new permissions, removed below
        bind.execute(sa.text("""
            DELETE FROM permission_role
            WHERE permission_id IN (SELECT id FROM permissions WHERE name = ANY(:names))
              AND role_id IN (SELECT id FROM user_roles WHERE name = :role AND tenant_id IS NULL)
        """), {"names": perms, "role": role})
    new = list(NEW_PERMISSIONS)
    bind.execute(sa.text("""
        DELETE FROM permission_role
        WHERE permission_id IN (SELECT id FROM permissions WHERE name = ANY(:names))
    """), {"names": new})
    bind.execute(sa.text("DELETE FROM permissions WHERE name = ANY(:names)"), {"names": new})
