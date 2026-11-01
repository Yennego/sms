"""Shared SQLite fixtures for the attendance tests.

Import the fixtures into a test module (`from attendance_fixtures import db, school`)
so pytest picks them up.
"""
import asyncio
from datetime import date
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import sessionmaker


@compiles(JSONB, "sqlite")
def _jsonb_as_json(type_, compiler, **kw):
    # promotion_criteria uses JSONB, which SQLite can't render
    return "JSON"


import src.db.models  # noqa: E402,F401  registers every model on Base.metadata
from src.db.models.base import Base  # noqa: E402
from src.db.models.tenant.tenant import Tenant  # noqa: E402
from src.db.models.auth.user_role import UserRole  # noqa: E402
from src.db.models.auth.admin import Admin  # noqa: E402
from src.db.models.people.student import Student  # noqa: E402
from src.db.models.people.teacher import Teacher  # noqa: E402
from src.db.models.people.parent import Parent  # noqa: E402
from src.db.models.academics.academic_year import AcademicYear  # noqa: E402
from src.db.models.academics.academic_grade import AcademicGrade  # noqa: E402
from src.db.models.academics.section import Section  # noqa: E402
from src.db.models.academics.class_model import Class  # noqa: E402
from src.db.models.academics.enrollment import Enrollment  # noqa: E402
from src.services.academics.attendance_service import AttendanceService  # noqa: E402

TODAY = date(2026, 10, 20)  # a Tuesday


def run(coro):
    return asyncio.run(coro)


@pytest.fixture
def db():
    engine = create_engine("sqlite:///:memory:")

    @event.listens_for(engine, "connect")
    def _fk_on(dbapi_conn, _):
        dbapi_conn.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()
    engine.dispose()


def make_user(cls, tenant_id, role, **extra):
    n = uuid4().hex[:8]
    obj = cls(
        tenant_id=tenant_id, email=f"{n}@test.local", password_hash="x",
        first_name="F" + n, last_name="L", **extra
    )
    obj.roles.append(role)
    return obj


@pytest.fixture
def school(db):
    """Tenant with one class (grade 5 / section A), its sponsor, another teacher,
    an admin, two enrolled students, one non-enrolled student and a parent."""
    tenant = Tenant(name="Test School", code="TST", domain="test")
    db.add(tenant)
    db.flush()
    t = tenant.id

    roles = {name: UserRole(name=name) for name in ["admin", "teacher", "student", "parent"]}
    db.add_all(roles.values())

    ay = AcademicYear(
        tenant_id=t, name="2026-2027", start_date=date(2026, 9, 1), end_date=date(2027, 6, 30),
        semester_1_start=date(2026, 9, 1), semester_1_end=date(2027, 1, 31),
        semester_2_start=date(2027, 2, 1), semester_2_end=date(2027, 6, 30), is_current=True,
    )
    grade = AcademicGrade(tenant_id=t, name="Grade 5", sequence=5)
    db.add_all([ay, grade])
    db.flush()
    section = Section(tenant_id=t, name="A", grade_id=grade.id)
    db.add(section)
    db.flush()

    sponsor = make_user(Teacher, t, roles["teacher"], employee_id="E1")
    other_teacher = make_user(Teacher, t, roles["teacher"], employee_id="E2")
    admin = make_user(Admin, t, roles["admin"])
    students = [make_user(Student, t, roles["student"], admission_number=f"A{i}") for i in range(3)]
    parent = make_user(Parent, t, roles["parent"], relationship_type="mother")
    db.add_all([sponsor, other_teacher, admin, parent, *students])
    db.flush()
    parent.students.append(students[0])

    cls = Class(
        tenant_id=t, name="Grade 5 - A", academic_year_id=ay.id, grade_id=grade.id,
        section_id=section.id, class_teacher_id=sponsor.id, start_date=ay.start_date
    )
    db.add(cls)
    for s in students[:2]:  # students[2] is NOT enrolled
        db.add(Enrollment(
            tenant_id=t, student_id=s.id, academic_year_id=ay.id,
            grade_id=grade.id, section_id=section.id, is_active=True
        ))
    db.commit()

    return dict(
        tenant_id=t, ay=ay, grade=grade, section=section, cls=cls, sponsor=sponsor,
        other_teacher=other_teacher, admin=admin, students=students, parent=parent, roles=roles,
        service=AttendanceService(tenant=t, db=db),
    )
