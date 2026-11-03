"""Each built-in staff role reaches what its menu needs and nothing it shouldn't (migration
c3f9a1d7e2b8): academics, students and attendance check permissions, not the admin role name.
Teachers keep exactly their role-based access."""
import importlib.util
from pathlib import Path
from uuid import uuid4

import main
from src.db.models.auth.admin import Admin
from src.db.models.auth.permission import Permission
from src.db.models.auth.user_role import UserRole
from src.db.models.people.teacher import Teacher
from src.db.session import get_db

from test_security import env, headers  # noqa: F401  shared app + two-school fixture

A = "/api/v1/academics"
_spec = importlib.util.spec_from_file_location(
    "staff_role_access", Path(__file__).parents[1] / "alembic" / "versions" / "c3f9a1d7e2b8_staff_role_access.py")
MIGRATION = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(MIGRATION)

# What the roles held before c3f9a1d7e2b8 (baseline, phase 4 and a7c3e9f1b2d4 grants)
BEFORE = {
    "academic-admin": ["manage_enrollment", "promote_students", "publish_results", "view_academic_data",
                       "manage_academic_data", "generate_academic_reports", "view_student_records",
                       "manage_student_records", "view_financial_data", "approve_financial_transactions"],
    "registrar": ["manage_enrollment", "promote_students", "view_academic_data", "view_student_records",
                  "manage_student_records"],
    "counselor": ["view_academic_data", "view_student_records"],
    "accountant": ["view_financial_data", "record_payments", "create_invoices", "manage_financial_data"],
    # the teacher's real grants: the new checks must not let any of these through
    "teacher": ["view_students", "view_classes", "view_subjects", "view_attendance", "manage_attendance",
                "mark_attendance", "view_student_records", "create_assignments", "grade_assignments",
                "manage_classroom_data", "view_assignments"],
}


def _people(ids):
    gen = main.app.dependency_overrides[get_db]()
    db = next(gen)
    perms = {}

    def perm(name):
        if name not in perms:
            perms[name] = db.query(Permission).filter(Permission.name == name).first() or Permission(name=name)
            db.add(perms[name])
        return perms[name]

    for name, before in BEFORE.items():
        role = UserRole(name=name)
        role.permissions = [perm(p) for p in sorted(set(before) | set(MIGRATION.GRANTS.get(name, [])))]
        cls, extra = (Teacher, {"employee_id": "T1"}) if name == "teacher" else (Admin, {})
        user = cls(tenant_id=ids["tenant_a"], email=f"{uuid4().hex[:8]}@school-a.org", password_hash="x",
                   first_name=name.title(), last_name="Staff", is_first_login=False, **extra)
        user.roles.append(role)
        db.add_all([role, user])
        db.flush()
        ids[name] = user.id
    next(gen, None)


def _get(client, ids, who, url):
    return client.get(url, headers=headers(ids, who)).status_code


def _post(client, ids, who, url, body=None):
    return client.post(url, json=body or {}, headers=headers(ids, who)).status_code


def test_principal(env):
    client, ids = env
    _people(ids)
    who = "academic-admin"
    for url in ("/api/v1/people/students", f"/api/v1/people/students/{ids['student_a']}", f"{A}/classes",
                f"{A}/sections", f"{A}/subjects", f"{A}/academic-grades", f"{A}/teacher-subject-assignments/workload?academic_year_id={uuid4()}",
                f"{A}/attendance/calendar?start_date=2026-11-01&end_date=2026-11-30", f"{A}/attendance/settings"):
        assert _get(client, ids, who, url) == 200, url
    assert _post(client, ids, who, f"{A}/academic-grades", {"name": "Grade 9", "sequence": 9}) in (200, 201)
    assert _post(client, ids, who, f"{A}/subjects", {"name": "Biology", "code": "BIO"}) in (200, 201)
    # attendance is read, not run; homework and deleting students stay with teachers and admins
    assert _get(client, ids, who, f"{A}/attendance/daily/excuses") == 403
    assert _get(client, ids, who, f"{A}/attendance/id-cards?class_id={uuid4()}") == 403
    assert _post(client, ids, who, f"{A}/attendance/daily/close-day") == 403
    assert client.delete(f"/api/v1/people/students/{ids['student_a']}", headers=headers(ids, who)).status_code == 403
    assert client.delete(f"{A}/assignments/{uuid4()}", headers=headers(ids, who)).status_code == 403


def test_registrar(env):
    client, ids = env
    _people(ids)
    who = "registrar"
    for url in ("/api/v1/people/students", f"/api/v1/people/students/{ids['student_a']}", f"{A}/classes",
                f"{A}/sections", f"{A}/subjects", f"{A}/attendance/calendar?start_date=2026-11-01&end_date=2026-11-30"):
        assert _get(client, ids, who, url) == 200, url
    assert _post(client, ids, who, f"{A}/academic-grades", {"name": "Grade 9", "sequence": 9}) in (200, 201)
    # no subjects, teacher assignments, year-end or running attendance
    assert _post(client, ids, who, f"{A}/subjects", {"name": "Biology", "code": "BIO"}) == 403
    assert _get(client, ids, who, f"{A}/teacher-subject-assignments/workload?academic_year_id={uuid4()}") == 403
    assert _post(client, ids, who, f"{A}/promotions/criteria", {}) == 403
    assert _get(client, ids, who, f"{A}/year-setup/{uuid4()}") == 403
    assert _get(client, ids, who, f"{A}/attendance/daily/excuses") == 403


def test_counselor(env):
    client, ids = env
    _people(ids)
    who = "counselor"
    assert _get(client, ids, who, "/api/v1/people/students") == 200
    assert _get(client, ids, who, f"/api/v1/people/students/{ids['student_a']}") == 200
    assert _get(client, ids, who, f"/api/v1/people/students/{ids['student_a']}/enrollments") == 200
    assert _get(client, ids, who, f"{A}/classes") == 403
    assert _post(client, ids, who, "/api/v1/people/admissions", {}) == 403
    assert client.put(f"/api/v1/people/students/{ids['student_a']}", json={"first_name": "X"},
                      headers=headers(ids, who)).status_code == 403


def test_accountant(env):
    client, ids = env
    _people(ids)
    who = "accountant"
    assert _get(client, ids, who, "/api/v1/people/students") == 200
    assert _get(client, ids, who, f"{A}/classes") == 403
    assert _get(client, ids, who, f"{A}/attendance/calendar?start_date=2026-11-01&end_date=2026-11-30") == 403
    assert _post(client, ids, who, "/api/v1/people/admissions", {}) == 403


def test_teacher_access_is_not_widened(env):
    """Teachers hold view_attendance, manage_attendance, view_classes...: none of it opens the
    whole-school or admin endpoints."""
    client, ids = env
    _people(ids)
    who = "teacher"
    assert _get(client, ids, who, f"{A}/classes") == 200  # by role, as before
    assert _get(client, ids, who, f"{A}/attendance/daily/excuses") == 403
    assert _get(client, ids, who, f"{A}/attendance/id-cards?class_id={uuid4()}") == 403
    assert _post(client, ids, who, f"{A}/attendance/daily/close-day") == 403
    assert _post(client, ids, who, f"{A}/academic-grades", {"name": "Grade 9", "sequence": 9}) == 403
    assert _get(client, ids, who, f"{A}/teacher-subject-assignments/workload?academic_year_id={uuid4()}") == 403
    assert client.delete(f"/api/v1/people/students/{ids['student_a']}", headers=headers(ids, who)).status_code == 403


def test_attendance_scope_follows_the_permissions():
    """Services decide scope the same way: whole-school readers see every class, only admins (or
    manage_school_attendance) run it, and a teacher's own permissions open neither."""
    from types import SimpleNamespace as NS
    from src.services.academics import attendance_access as access

    def user(role, *perms):
        return NS(roles=[NS(name=role, tenant_id=None, permissions=[NS(name=p) for p in perms])])

    principal = user("academic-admin", *MIGRATION.GRANTS["academic-admin"])
    teacher = user("teacher", *BEFORE["teacher"])
    assert access.can_view_school_attendance(principal) and not access.is_admin(principal)
    assert not access.can_view_school_attendance(teacher) and not access.is_admin(teacher)
    assert access.is_admin(user("admin")) and access.can_view_school_attendance(user("admin"))
    assert access.is_admin(user("deputy", "manage_school_attendance"))
    assert access.resolve_viewable_student_id(None, principal, "s1") == "s1"


def test_students_cannot_list_staff(env):
    """The teacher list (names, emails, phones) is for staff and teachers, not students or parents."""
    client, ids = env
    assert client.get("/api/v1/people/teachers", headers=headers(ids, "student_a")).status_code == 403
    assert client.get("/api/v1/people/teachers", headers=headers(ids, "admin_a")).status_code == 200


def test_school_dashboard_for_admin_and_principal(env):
    """The school dashboard summary is for the admin and the principal, not other office roles."""
    client, ids = env
    _people(ids)
    url = "/api/v1/tenants/dashboard/stats"
    assert _get(client, ids, "admin_a", url) == 200
    assert _get(client, ids, "academic-admin", url) == 200
    for who in ("registrar", "counselor", "accountant", "teacher", "student_a"):
        assert _get(client, ids, who, url) == 403, who
