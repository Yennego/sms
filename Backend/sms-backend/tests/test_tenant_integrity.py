"""Per-school uniqueness: two schools can reuse emails and admission numbers, one school can't."""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker

import attendance_fixtures  # noqa: F401  registers models and the SQLite JSONB shim
from src.db.models.base import Base
from src.db.models.people.student import Student
from src.db.models.people.teacher import Teacher
from src.db.models.tenant.tenant import Tenant


@pytest.fixture
def db():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    a = Tenant(name="School A", code="SCA", domain="school-a")
    b = Tenant(name="School B", code="SCB", domain="school-b")
    session.add_all([a, b])
    session.flush()
    session.info["schools"] = (a, b)
    yield session
    session.close()
    engine.dispose()


def _student(tenant, email, admission_number):
    return Student(tenant_id=tenant.id, email=email, password_hash="x", first_name="F",
                   last_name="L", admission_number=admission_number)


def test_two_schools_can_reuse_email_and_admission_number(db):
    a, b = db.info["schools"]
    db.add_all([_student(a, "kid@family.org", "STU0001"), _student(b, "kid@family.org", "STU0001")])
    db.flush()
    rows = db.query(Student).all()
    assert len(rows) == 2
    # tenant_id is written to both users and students
    assert {s.tenant_id for s in rows} == {a.id, b.id}


def test_same_school_rejects_duplicate_admission_number(db):
    a, _ = db.info["schools"]
    db.add_all([_student(a, "one@family.org", "STU0001"), _student(a, "two@family.org", "STU0001")])
    with pytest.raises(IntegrityError):
        db.flush()


def test_same_school_rejects_duplicate_email_any_case(db):
    a, _ = db.info["schools"]
    db.add_all([_student(a, "Kid@Family.org", "STU0001"), _student(a, "kid@family.org", "STU0002")])
    with pytest.raises(IntegrityError):
        db.flush()


def test_same_school_rejects_duplicate_employee_id(db):
    a, _ = db.info["schools"]
    db.add_all([
        Teacher(tenant_id=a.id, email=f"t{i}@school-a.org", password_hash="x", first_name="T",
                last_name="L", employee_id="EMP001")
        for i in range(2)
    ])
    with pytest.raises(IntegrityError):
        db.flush()
