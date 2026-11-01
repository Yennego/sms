"""One enrollment table: every enrollment names its class, and its year/grade/section are the
class's (PostgreSQL enforces this with fk_tn_enrollments_class_id; SQLite can't, so these tests
check the service and model logic that keeps it true)."""
from datetime import date
from uuid import uuid4

import pytest

from attendance_fixtures import db, school, run, make_user  # noqa: F401  (pytest fixtures)
from src.core.exceptions.business import (
    BusinessRuleViolationError,
    DuplicateEntityError,
    EntityNotFoundError,
    InvalidStatusTransitionError,
)
from src.db.models.academics.academic_year import AcademicYear
from src.db.models.academics.class_model import Class
from src.db.models.academics.enrollment import Enrollment
from src.db.models.academics.section import Section
from src.db.models.people.student import Student
from src.db.models.tenant.tenant import Tenant
from src.schemas.academics.class_enrollment import (
    BulkClassEnrollmentCreate,
    ClassEnrollmentCreate,
    ClassEnrollmentUpdate,
)
from src.services.academics.class_enrollment_service import ClassEnrollmentService


def assert_consistent(db):
    """Every enrollment has a class of its own school with the same year/grade/section."""
    db.flush()
    for e in db.query(Enrollment).all():
        cls = db.get(Class, e.class_id)
        assert cls is not None, "enrollment without a class"
        assert cls.tenant_id == e.tenant_id
        assert (e.academic_year_id, e.grade_id, e.section_id) == (
            cls.academic_year_id, cls.grade_id, cls.section_id
        )


def second_class(db, school, name="B"):
    section = Section(tenant_id=school["tenant_id"], name=name, grade_id=school["grade"].id)
    db.add(section)
    db.flush()
    cls = Class(
        tenant_id=school["tenant_id"], name=f"Grade 5 - {name}", academic_year_id=school["ay"].id,
        grade_id=school["grade"].id, section_id=section.id, start_date=school["ay"].start_date,
    )
    db.add(cls)
    db.flush()
    return cls, section


def other_year(db, school):
    ay = AcademicYear(
        tenant_id=school["tenant_id"], name="2027-2028", start_date=date(2027, 9, 1), end_date=date(2028, 6, 30),
        semester_1_start=date(2027, 9, 1), semester_1_end=date(2028, 1, 31),
        semester_2_start=date(2028, 2, 1), semester_2_end=date(2028, 6, 30),
    )
    db.add(ay)
    db.flush()
    return ay


def test_existing_enrollments_get_their_class(db, school):
    for e in db.query(Enrollment).all():
        assert e.class_id == school["cls"].id
    assert_consistent(db)


def test_enroll_student_in_class(db, school):
    svc = ClassEnrollmentService(tenant=school["tenant_id"], db=db)
    student = school["students"][2]  # not enrolled yet
    ce = run(svc.enroll_student(obj_in=ClassEnrollmentCreate(
        student_id=student.id, class_id=school["cls"].id, academic_year_id=school["ay"].id,
    )))
    e = db.get(Enrollment, ce.id)  # one row: the class enrollment is the enrollment
    assert ce.class_id == school["cls"].id and ce.status == "active" and ce.is_active
    assert e.grade_id == school["grade"].id and e.section_id == school["section"].id
    assert e.grade == "Grade 5" and e.section == "A"
    assert db.query(Enrollment).filter_by(student_id=student.id).count() == 1
    assert run(svc.get_class_enrollment_count(class_id=school["cls"].id)) == 3
    roster = run(svc.get_students_in_class(class_id=school["cls"].id))
    assert {r.student_id for r in roster} == {s.id for s in school["students"]}
    assert all(r.enrollment_id == r.id for r in roster)

    # same class again, or another class the same year: conflict (move instead)
    with pytest.raises(DuplicateEntityError):
        run(svc.enroll_student(obj_in=ClassEnrollmentCreate(
            student_id=student.id, class_id=school["cls"].id, academic_year_id=school["ay"].id,
        )))
    cls_b, _ = second_class(db, school)
    with pytest.raises(DuplicateEntityError):
        run(svc.enroll_student(obj_in=ClassEnrollmentCreate(
            student_id=student.id, class_id=cls_b.id, academic_year_id=school["ay"].id,
        )))
    assert_consistent(db)


def test_enroll_checks_year_and_school(db, school):
    svc = ClassEnrollmentService(tenant=school["tenant_id"], db=db)
    student = school["students"][2]
    with pytest.raises(BusinessRuleViolationError):
        run(svc.enroll_student(obj_in=ClassEnrollmentCreate(
            student_id=student.id, class_id=school["cls"].id, academic_year_id=other_year(db, school).id,
        )))

    other = Tenant(name="Other School", code="OTH", domain="other")
    db.add(other)
    db.flush()
    foreign = ClassEnrollmentService(tenant=other.id, db=db)
    with pytest.raises(EntityNotFoundError):  # another school's student/class are invisible
        run(foreign.enroll_student(obj_in=ClassEnrollmentCreate(
            student_id=student.id, class_id=school["cls"].id, academic_year_id=school["ay"].id,
        )))
    assert run(foreign.get(school["students"][0].id)) is None
    assert run(foreign.get_class_enrollment_count(class_id=school["cls"].id)) == 0


def test_bulk_enroll(db, school):
    svc = ClassEnrollmentService(tenant=school["tenant_id"], db=db)
    result = run(svc.bulk_enroll_students(bulk_data=BulkClassEnrollmentCreate(
        class_id=school["cls"].id, academic_year_id=school["ay"].id,
        student_ids=[s.id for s in school["students"]] + [uuid4()],
    )))
    assert [c.student_id for c in result["created"]] == [school["students"][2].id]
    assert len(result["failed"]) == 3  # two already enrolled, one unknown
    assert_consistent(db)


def test_move_to_another_class(db, school):
    svc = ClassEnrollmentService(tenant=school["tenant_id"], db=db)
    cls_b, section_b = second_class(db, school)
    e = db.query(Enrollment).filter_by(student_id=school["students"][0].id).one()

    moved = run(svc.update(id=e.id, obj_in=ClassEnrollmentUpdate(class_id=cls_b.id)))
    assert moved.class_id == cls_b.id
    assert e.section_id == section_b.id and e.section == "B"
    assert run(svc.get_class_enrollment_count(class_id=school["cls"].id)) == 1
    assert run(svc.get_class_enrollment_count(class_id=cls_b.id)) == 1

    other_cls = Class(
        tenant_id=school["tenant_id"], academic_year_id=other_year(db, school).id,
        grade_id=school["grade"].id, section_id=school["section"].id, start_date=date(2027, 9, 1),
    )
    db.add(other_cls)
    db.flush()
    with pytest.raises(BusinessRuleViolationError):
        run(svc.move_to_class(enrollment_id=e.id, class_id=other_cls.id))
    assert_consistent(db)


def test_withdraw_reactivate_complete(db, school):
    svc = ClassEnrollmentService(tenant=school["tenant_id"], db=db)
    e = db.query(Enrollment).filter_by(student_id=school["students"][0].id).one()

    dropped = run(svc.drop_student_from_class(enrollment_id=e.id, drop_date="2026-10-01"))
    assert (dropped.status, dropped.is_active, dropped.drop_date) == ("withdrawn", False, date(2026, 10, 1))
    assert e.withdrawal_date == date(2026, 10, 1)
    assert run(svc.get_class_enrollment_count(class_id=school["cls"].id, is_active=True)) == 1
    assert run(svc.count(status="dropped")) == 1  # old status name still filters

    back = run(svc.reactivate_enrollment(enrollment_id=e.id))
    assert (back.status, back.is_active, back.drop_date) == ("active", True, None)
    with pytest.raises(InvalidStatusTransitionError):
        run(svc.reactivate_enrollment(enrollment_id=e.id))

    done = run(svc.complete_student_enrollment(enrollment_id=e.id, completion_date=date(2027, 6, 30)))
    assert (done.status, done.completion_date, done.drop_date) == ("completed", date(2027, 6, 30), None)
    with pytest.raises(InvalidStatusTransitionError):
        run(svc.drop_student_from_class(enrollment_id=e.id))

    # a withdrawn student enrolled again that year comes back in the chosen class
    other = db.query(Enrollment).filter_by(student_id=school["students"][1].id).one()
    run(svc.drop_student_from_class(enrollment_id=other.id))
    cls_b, _ = second_class(db, school)
    again = run(svc.enroll_student(obj_in=ClassEnrollmentCreate(
        student_id=school["students"][1].id, class_id=cls_b.id, academic_year_id=school["ay"].id,
    )))
    assert again.id == other.id and again.class_id == cls_b.id and again.status == "active"
    assert_consistent(db)


def test_enrollment_by_grade_and_section_finds_or_creates_the_class(db, school):
    # (EnrollmentService.create goes through TenantCRUDBase.create, whose jsonable_encoder
    # strings SQLite can't store; the same flush hook runs there on PostgreSQL.)
    student = school["students"][2]
    section_c = Section(tenant_id=school["tenant_id"], name="C", grade_id=school["grade"].id)
    db.add(section_c)
    db.flush()

    e = Enrollment(
        tenant_id=school["tenant_id"], student_id=student.id, academic_year_id=school["ay"].id,
        grade_id=school["grade"].id, section_id=section_c.id,
    )
    db.add(e)
    db.flush()
    cls = db.get(Class, e.class_id)  # no class for C yet: created like the migration does
    assert cls.name == "Grade 5 - C" and cls.section_id == section_c.id

    # changing grade/section on the enrollment moves it to that class
    e.section_id = school["section"].id
    db.flush()
    assert e.class_id == school["cls"].id
    assert db.query(Class).count() == 2
    assert_consistent(db)


def test_explicit_class_wins_over_grade_and_section(db, school):
    cls_b, section_b = second_class(db, school)
    student = school["students"][2]
    e = Enrollment(
        tenant_id=school["tenant_id"], student_id=student.id, academic_year_id=school["ay"].id,
        grade_id=school["grade"].id, section_id=school["section"].id, class_id=cls_b.id,
    )
    db.add(e)
    db.flush()
    assert e.section_id == section_b.id
    assert_consistent(db)


def test_class_identity_change_moves_its_enrollments(db, school):
    _, section_b = second_class(db, school, name="X")
    cls = db.query(Class).filter_by(id=school["cls"].id).one()
    db.delete(db.query(Class).filter_by(section_id=section_b.id).one())  # free the identity
    db.flush()
    cls.section_id = section_b.id
    db.flush()
    db.expire_all()
    assert {e.section_id for e in db.query(Enrollment).all()} == {section_b.id}
    assert_consistent(db)


def test_class_of_another_school_is_rejected(db, school):
    other = Tenant(name="Other School", code="OTH", domain="other")
    db.add(other)
    db.flush()
    e = db.query(Enrollment).filter_by(student_id=school["students"][0].id).one()
    foreign_cls = Class(
        tenant_id=other.id, academic_year_id=school["ay"].id, grade_id=school["grade"].id,
        section_id=school["section"].id, start_date=date(2026, 9, 1),
    )
    db.add(foreign_cls)
    db.flush()
    e.class_id = foreign_cls.id
    with pytest.raises(ValueError):
        db.flush()
