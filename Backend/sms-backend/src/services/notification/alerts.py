"""The automatic alerts (phase6-design.md §1): absent, late, results published, payment received.

Each goes to the student's linked parents (parent_student); results also to the student. One
alert per student, day and kind for attendance (source keys below), so repeating the action that
caused it sends nothing new. Texts hold no more than the alert's one line (§2).
"""
from datetime import date, datetime
from typing import Dict, Iterable, List, Optional, Tuple
from uuid import UUID

from sqlalchemy.orm import Session

from src.db.models.people.parent import parent_student
from src.db.models.people.student import Student
from src.db.models.tenant.tenant import Tenant
from src.services.notification.notify import notify


def _uuid(value) -> UUID:
    return value if isinstance(value, UUID) else UUID(str(value))


def parents_of(db: Session, tenant_id, student_ids: Iterable) -> Dict[UUID, List[UUID]]:
    """Each student's linked parents in this school."""
    ids = list({_uuid(s) for s in student_ids})
    out: Dict[UUID, List[UUID]] = {i: [] for i in ids}
    if not ids:
        return out
    for parent_id, student_id in db.query(parent_student.c.parent_id, parent_student.c.student_id).filter(
            parent_student.c.tenant_id == _uuid(tenant_id), parent_student.c.student_id.in_(ids)).all():
        out[student_id].append(parent_id)
    return out


def school_prefix(db: Session, tenant_id) -> str:
    """The school's part of app paths ("/foundation"); empty if the school has no address."""
    domain = db.query(Tenant.domain).filter(Tenant.id == _uuid(tenant_id)).scalar()
    return f"/{domain}" if domain else ""


def _students(db: Session, tenant_id, ids: Iterable) -> Dict[UUID, Student]:
    ids = list({_uuid(i) for i in ids})
    if not ids:
        return {}
    return {s.id: s for s in db.query(Student).filter(Student.tenant_id == _uuid(tenant_id), Student.id.in_(ids))}


def _name(s: Student) -> str:
    return f"{s.first_name or ''} {s.last_name or ''}".strip()


def _day(d: date) -> str:
    return f"{d.strftime('%a')} {d.day} {d.strftime('%b %Y')}"


def attendance_absent(db: Session, tenant_id, items: Iterable[Tuple[UUID, date]]) -> int:
    """Students marked absent (at the cut-off or by staff): (student_id, date) pairs."""
    items = list(items)
    if not items:
        return 0
    students = _students(db, tenant_id, [s for s, _ in items])
    parents = parents_of(db, tenant_id, students.keys())
    prefix = school_prefix(db, tenant_id)
    created = 0
    for student_id, on_date in items:
        student = students.get(_uuid(student_id))
        if student is None or not parents.get(student.id):
            continue
        created += notify(
            db, tenant_id, event="attendance_absent", recipients=parents[student.id],
            title=f"{student.first_name} was absent",
            body=f"{_name(student)} was marked absent on {_day(on_date)}.",
            link=f"{prefix}/parent/attendance?child={student.id}",
            data={"student_id": str(student.id), "date": on_date.isoformat()},
            source_key=f"absent:{student.id}:{on_date.isoformat()}",
        )
    return created


def attendance_late(db: Session, tenant_id, student_id, on_date: date, arrived: datetime) -> int:
    """A student scanned in late. `arrived` is in the school's time zone."""
    student = _students(db, tenant_id, [student_id]).get(_uuid(student_id))
    if student is None:
        return 0
    parents = parents_of(db, tenant_id, [student.id])[student.id]
    return notify(
        db, tenant_id, event="attendance_late", recipients=parents,
        title=f"{student.first_name} arrived late",
        body=f"{_name(student)} arrived late at {arrived.strftime('%H:%M')} on {_day(on_date)}.",
        link=f"{school_prefix(db, tenant_id)}/parent/attendance?child={student.id}",
        data={"student_id": str(student.id), "date": on_date.isoformat()},
        source_key=f"late:{student.id}:{on_date.isoformat()}",
    )


def results_published(db: Session, tenant_id, student_ids: Iterable, *, class_name: str, scope_name: str,
                      scope_id) -> int:
    """A class's period (or semester) results were published: each student and their parents.
    One alert per student and period/semester (publishing again after unpublishing adds nothing)."""
    students = _students(db, tenant_id, student_ids)
    parents = parents_of(db, tenant_id, students.keys())
    prefix = school_prefix(db, tenant_id)
    created = 0
    for student in students.values():
        key = f"results:{scope_id}:{student.id}"
        data = {"student_id": str(student.id), "scope_id": str(scope_id)}
        created += notify(
            db, tenant_id, event="results_published", recipients=[student.id],
            title="Results published", body=f"Your {scope_name} results ({class_name}) are published.",
            link=f"{prefix}/student/grades", data=data, source_key=key,
        )
        created += notify(
            db, tenant_id, event="results_published", recipients=parents[student.id],
            title=f"{student.first_name}'s results are published",
            body=f"{_name(student)}'s {scope_name} results ({class_name}) are published.",
            link=f"{prefix}/parent/results?child={student.id}", data=data, source_key=key,
        )
    return created


def payment_received(db: Session, tenant_id, student_id, *, payment_id, amount: str, currency: str,
                     receipt_number: str) -> int:
    student = _students(db, tenant_id, [student_id]).get(_uuid(student_id))
    if student is None:
        return 0
    parents = parents_of(db, tenant_id, [student.id])[student.id]
    return notify(
        db, tenant_id, event="payment_received", recipients=parents,
        title="Payment received",
        body=f"{currency} {amount} received for {_name(student)}, receipt {receipt_number}.",
        link=f"{school_prefix(db, tenant_id)}/parent/fees?child={student.id}",
        data={"student_id": str(student.id), "payment_id": str(payment_id)},
        source_key=f"payment:{payment_id}",
    )
