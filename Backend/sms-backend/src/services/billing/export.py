"""A school's data export (phase7-design.md §1 "Export"): a zip of CSV files, available to the
school's admins at any time, whatever the billing status. Data is never deleted for non-payment.

Files: students.csv, guardians.csv (one row per guardian and child), enrollments.csv,
results.csv (scores of assessments whose term has been published for the class) and
fee_payments.csv. Every query filters by the school (row level security applies too).
"""
import csv
import io
import zipfile
from datetime import datetime, UTC
from typing import Iterable, List, Sequence

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from src.db.models.academics.academic_year import AcademicYear
from src.db.models.academics.assessment import Assessment
from src.db.models.academics.class_model import Class
from src.db.models.academics.class_subject import ClassSubject
from src.db.models.academics.enrollment import Enrollment
from src.db.models.academics.gradebook import ResultPublication, ScoreEntry
from src.db.models.academics.period import Period
from src.db.models.academics.semester import Semester
from src.db.models.academics.subject import Subject
from src.db.models.finance.fees import Payment, StudentFeeAccount
from src.db.models.people.parent import Parent, parent_student
from src.db.models.people.student import Student
from src.services.finance.ledger import money


def _csv(header: Sequence[str], rows: Iterable[Sequence]) -> bytes:
    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow(header)
    for row in rows:
        writer.writerow(["" if v is None else v for v in row])
    return ("﻿" + out.getvalue()).encode("utf-8")  # BOM: spreadsheets open it as UTF-8


def _students(db: Session, t) -> bytes:
    rows = (db.query(Student).filter(Student.tenant_id == t).order_by(Student.last_name, Student.first_name))
    return _csv(("student_id", "admission_number", "first_name", "last_name", "username", "email", "gender",
                 "date_of_birth", "admission_date", "status", "phone_number", "address", "city", "county", "country",
                 "is_active"),
                ((s.id, s.admission_number, s.first_name, s.last_name, s.username, s.email, s.gender, s.date_of_birth,
                  s.admission_date, s.status, s.phone_number, s.address, s.city, s.county, s.country, s.is_active)
                 for s in rows))


def _guardians(db: Session, t) -> bytes:
    children = {}
    for parent_id, adm, fn, ln in (db.query(parent_student.c.parent_id, Student.admission_number, Student.first_name,
                                            Student.last_name)
                                   .join(Student, and_(Student.id == parent_student.c.student_id, Student.tenant_id == t))
                                   .filter(parent_student.c.tenant_id == t)):
        children.setdefault(parent_id, []).append((adm, f"{fn} {ln}"))
    parents = (db.query(Parent.id, Parent.first_name, Parent.last_name, Parent.relationship_type, Parent.username,
                        Parent.email, Parent.phone_number, Parent.whatsapp_number, Parent.occupation, Parent.address,
                        Parent.is_active)
               .filter(Parent.tenant_id == t).order_by(Parent.last_name, Parent.first_name).all())
    return _csv(("guardian_id", "first_name", "last_name", "relationship", "username", "email", "phone_number",
                 "whatsapp_number", "occupation", "address", "is_active", "student_admission_number", "student_name"),
                (tuple(p) + child for p in parents for child in (children.get(p[0]) or [(None, None)])))


def _enrollments(db: Session, t) -> bytes:
    rows = (db.query(Enrollment, Student.admission_number, Student.first_name, Student.last_name, AcademicYear.name,
                     Class.name)
            .join(Student, and_(Student.id == Enrollment.student_id, Student.tenant_id == t))
            .join(AcademicYear, and_(AcademicYear.id == Enrollment.academic_year_id, AcademicYear.tenant_id == t))
            .outerjoin(Class, and_(Class.id == Enrollment.class_id, Class.tenant_id == t))
            .filter(Enrollment.tenant_id == t).order_by(AcademicYear.start_date, Student.last_name))
    return _csv(("enrollment_id", "admission_number", "student_name", "academic_year", "class", "status",
                 "enrollment_date", "withdrawal_date", "withdrawal_reason"),
                ((e.id, adm, f"{fn} {ln}", year, cls, e.status, e.enrollment_date, e.withdrawal_date,
                  e.withdrawal_reason) for e, adm, fn, ln, year, cls in rows))


def _results(db: Session, t) -> bytes:
    published = db.query(ResultPublication).filter(ResultPublication.tenant_id == t).all()
    by_period = {(p.class_id, p.period_id): p.published_at for p in published if p.period_id}
    by_semester = {(p.class_id, p.semester_id): p.published_at for p in published if p.semester_id}
    rows = (db.query(ScoreEntry, Assessment, Class.id, Class.name, Subject.name, Student.admission_number,
                     Student.first_name, Student.last_name, Period.name, Semester.name)
            .join(Assessment, and_(Assessment.id == ScoreEntry.assessment_id, Assessment.tenant_id == t))
            .join(ClassSubject, and_(ClassSubject.id == Assessment.class_subject_id, ClassSubject.tenant_id == t))
            .join(Class, and_(Class.id == ClassSubject.class_id, Class.tenant_id == t))
            .join(Subject, and_(Subject.id == Assessment.subject_id, Subject.tenant_id == t))
            .join(Student, and_(Student.id == ScoreEntry.student_id, Student.tenant_id == t))
            .outerjoin(Period, and_(Period.id == Assessment.period_id, Period.tenant_id == t))
            .outerjoin(Semester, and_(Semester.id == Assessment.semester_id, Semester.tenant_id == t))
            .filter(ScoreEntry.tenant_id == t,
                    or_(Assessment.period_id.isnot(None), Assessment.semester_id.isnot(None)))
            .order_by(Class.name, Student.last_name, Subject.name, Assessment.assessment_date))
    out: List[Sequence] = []
    for s, a, class_id, class_name, subject, adm, fn, ln, period, semester in rows:
        published_at = (by_period.get((class_id, a.period_id)) if a.period_id
                        else by_semester.get((class_id, a.semester_id)))
        if published_at is None:
            continue
        out.append((adm, f"{fn} {ln}", class_name, subject, period or semester, a.title, a.kind, a.max_score,
                    s.score, s.status, s.comment, published_at))
    return _csv(("admission_number", "student_name", "class", "subject", "term", "assessment", "kind", "max_score",
                 "score", "status", "comment", "published_at"), out)


def _fee_payments(db: Session, t) -> bytes:
    rows = (db.query(Payment, Student.admission_number, Student.first_name, Student.last_name)
            .join(StudentFeeAccount, and_(StudentFeeAccount.id == Payment.account_id, StudentFeeAccount.tenant_id == t))
            .join(Student, and_(Student.id == StudentFeeAccount.student_id, Student.tenant_id == t))
            .filter(Payment.tenant_id == t).order_by(Payment.received_at))
    return _csv(("receipt_number", "received_at", "admission_number", "student_name", "amount", "currency", "method",
                 "reference", "voided_at", "void_reason"),
                ((p.receipt_number, p.received_at, adm, f"{fn} {ln}", money(p.amount), p.currency, p.method, p.reference,
                  p.voided_at, p.void_reason) for p, adm, fn, ln in rows))


EXPORTS = (("students.csv", _students), ("guardians.csv", _guardians), ("enrollments.csv", _enrollments),
           ("results.csv", _results), ("fee_payments.csv", _fee_payments))


def school_export(db: Session, tenant_id) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as z:
        for name, build in EXPORTS:
            z.writestr(name, build(db, tenant_id))
    return buffer.getvalue()


def export_filename(code: str) -> str:
    return f"{(code or 'school').lower()}-export-{datetime.now(UTC):%Y-%m-%d}.zip"
