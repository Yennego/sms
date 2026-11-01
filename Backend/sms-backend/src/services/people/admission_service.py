"""Admit and enroll students (docs/remodel/phase3-api.md §2, 03-app-flow.md §4.3).

One admission creates the student, their guardian (or links an existing one) and the enrollment
in a class of the current school year. Everything is staged in the request's unit of work, so it
is saved together or not at all. New accounts get a generated password, returned once so the
office can hand it over; it must be changed at first sign-in.
"""
import re
from dataclasses import dataclass, field
from datetime import date
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from src.core.security.password import generate_default_password, get_password_hash
from src.db.crud.people.student import student as student_crud
from src.db.models.academics.academic_year import AcademicYear
from src.db.models.academics.class_model import Class
from src.db.models.academics.enrollment import Enrollment
from src.db.models.auth.user import User
from src.db.models.auth.user_role import UserRole
from src.db.models.auth.username import username_problem
from src.db.models.people.parent import Parent
from src.db.models.people.student import Student

EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
GENDERS = {"male", "female", "other"}
MAX_IMPORT_ROWS = 500


def _blank(value: Any) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _full_name(person) -> str:
    return f"{person.first_name} {person.last_name}".strip()


@dataclass
class Credentials:
    who: str
    name: str
    username: str
    password: str


@dataclass
class AdmissionResult:
    student: Student
    guardian: Optional[Parent]
    guardian_created: bool
    enrollment: Enrollment
    klass: Class
    credentials: List[Credentials] = field(default_factory=list)


class AdmissionService:
    def __init__(self, db: Session, tenant_id: UUID):
        self.db = db
        self.tenant_id = tenant_id
        self._roles: Dict[str, Optional[UserRole]] = {}

    # --- lookups -------------------------------------------------------------------------------

    def _role(self, name: str) -> Optional[UserRole]:
        if name not in self._roles:
            self._roles[name] = self.db.query(UserRole).filter(
                UserRole.name == name, UserRole.tenant_id.is_(None)
            ).first()
        return self._roles[name]

    def current_year(self) -> AcademicYear:
        year = self.db.query(AcademicYear).filter(
            AcademicYear.tenant_id == self.tenant_id, AcademicYear.is_current == True  # noqa: E712
        ).first()
        if not year:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail="Set the current school year before admitting students.")
        return year

    def class_for_admission(self, class_id: UUID) -> Class:
        klass = self.db.query(Class).filter(Class.id == class_id, Class.tenant_id == self.tenant_id).first()
        if not klass:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found")
        return klass

    def _taken(self, column, value: Optional[str]) -> bool:
        if not value:
            return False
        return self.db.query(User.id).filter(
            User.tenant_id == self.tenant_id, func.lower(column) == value.lower()
        ).first() is not None

    def search_guardians(self, q: str, limit: int = 20) -> List[Dict[str, Any]]:
        term = f"%{q.strip()}%"
        if len(q.strip()) < 2:
            return []
        rows = self.db.query(Parent).filter(
            Parent.tenant_id == self.tenant_id,
            or_(
                func.concat(Parent.first_name, " ", Parent.last_name).ilike(term),
                Parent.username.ilike(term), Parent.email.ilike(term), Parent.phone_number.ilike(term),
            ),
        ).order_by(Parent.last_name, Parent.first_name).limit(limit).all()
        return [{
            "id": p.id, "name": _full_name(p), "username": p.username, "email": p.email,
            "phone_number": p.phone_number, "children": [_full_name(s) for s in p.students],
        } for p in rows]

    # --- creating accounts ---------------------------------------------------------------------

    def _new_password(self) -> Tuple[str, str]:
        password = generate_default_password()
        return password, get_password_hash(password)

    def _check_identifiers(self, email: Optional[str], username: Optional[str], who: str) -> None:
        if self._taken(User.email, email):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"The {who}'s email is already used in this school.")
        if self._taken(User.username, username):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"The {who}'s username is already used in this school.")

    def _guardian_for(self, guardian_in: Dict[str, Any]) -> Tuple[Parent, bool, Optional[str]]:
        """An existing guardian of this school (existing_id), or a new one with a parent sign-in.
        Returns (guardian, created, password to hand over when created)."""
        existing_id = guardian_in.get("existing_id")
        if existing_id:
            guardian = self.db.query(Parent).filter(Parent.id == existing_id, Parent.tenant_id == self.tenant_id).first()
            if not guardian:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Guardian not found")
            return guardian, False, None
        g_email, g_username = _blank(guardian_in.get("email")), _blank(guardian_in.get("username"))
        self._check_identifiers(g_email, g_username, "guardian")
        password, g_hash = self._new_password()
        guardian = Parent(
            tenant_id=self.tenant_id,
            first_name=guardian_in["first_name"].strip(), last_name=guardian_in["last_name"].strip(),
            email=g_email, username=g_username, phone_number=_blank(guardian_in.get("phone_number")),
            relationship_type=_blank(guardian_in.get("relationship_type")) or "guardian",
            password_hash=g_hash, is_first_login=True, is_active=True,
        )
        if self._role("parent"):
            guardian.roles.append(self._role("parent"))
        self.db.add(guardian)
        return guardian, True, password

    def _student(self, student_id: UUID) -> Student:
        student = self.db.query(Student).filter(Student.id == student_id, Student.tenant_id == self.tenant_id).first()
        if not student:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
        return student

    def add_guardian(self, student_id: UUID, guardian_in: Dict[str, Any]) -> Tuple[Parent, bool, List[Credentials]]:
        """Link a guardian to a student already in the school: an existing guardian (a parent with
        children here already) or a new one, who gets a parent sign-in to hand over."""
        student = self._student(student_id)
        guardian, created, password = self._guardian_for(guardian_in)
        if not created and any(s.id == student.id for s in guardian.students):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                                detail=f"{_full_name(guardian)} is already a guardian of {_full_name(student)}.")
        guardian.students.append(student)
        self.db.flush()  # assigns the new guardian's username
        credentials = [Credentials("guardian", _full_name(guardian), guardian.username, password)] if created else []
        return guardian, created, credentials

    def remove_guardian(self, student_id: UUID, guardian_id: UUID) -> None:
        """Unlink a guardian from a student. The guardian's account stays (it may have other
        children here, and the school can deactivate it separately)."""
        student = self._student(student_id)
        guardian = self.db.query(Parent).filter(Parent.id == guardian_id, Parent.tenant_id == self.tenant_id).first()
        if not guardian or not any(s.id == student.id for s in guardian.students):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="This guardian isn't linked to the student")
        guardian.students.remove(student)
        self.db.flush()

    def admit(self, student_in: Dict[str, Any], guardian_in: Optional[Dict[str, Any]], class_id: UUID) -> AdmissionResult:
        year = self.current_year()
        klass = self.class_for_admission(class_id)
        if klass.academic_year_id != year.id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail="Choose a class of the current school year.")

        student_email, student_username = _blank(student_in.get("email")), _blank(student_in.get("username"))
        self._check_identifiers(student_email, student_username, "student")
        admission_number = _blank(student_in.get("admission_number"))
        if admission_number and student_crud.get_by_admission_number(self.db, self.tenant_id, admission_number):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="That admission number is already used in this school.")

        credentials: List[Credentials] = []
        password, password_hash = self._new_password()
        student = Student(
            tenant_id=self.tenant_id,
            first_name=student_in["first_name"].strip(), last_name=student_in["last_name"].strip(),
            email=student_email, username=student_username,
            gender=_blank(student_in.get("gender")), date_of_birth=student_in.get("date_of_birth"),
            address=_blank(student_in.get("address")),
            admission_number=admission_number or student_crud.generate_admission_number(self.db, self.tenant_id),
            admission_date=student_in.get("admission_date") or date.today(),
            password_hash=password_hash, is_first_login=True, is_active=True,
        )
        if self._role("student"):
            student.roles.append(self._role("student"))
        self.db.add(student)

        guardian, guardian_created, guardian_password = None, False, None
        if guardian_in:
            guardian, guardian_created, guardian_password = self._guardian_for(guardian_in)
            guardian.students.append(student)

        enrollment = Enrollment(
            tenant_id=self.tenant_id, student=student, academic_year_id=year.id, class_id=klass.id,
            grade_id=klass.grade_id, section_id=klass.section_id, status="active", is_active=True,
            enrollment_date=date.today(),
        )
        self.db.add(enrollment)
        self.db.flush()  # assigns usernames and ids
        # Billing already started this term: bill them like their classmates
        from src.services.finance.fee_service import FeeService
        FeeService(self.db, self.tenant_id, None).bill_new_enrollment([student.id], year.id)

        credentials.append(Credentials("student", _full_name(student), student.username, password))
        if guardian_created:
            credentials.append(Credentials("guardian", _full_name(guardian), guardian.username, guardian_password))
        return AdmissionResult(student, guardian, guardian_created, enrollment, klass, credentials)

    # --- spreadsheet import ----------------------------------------------------------------------

    def _classes_by_name(self, year: AcademicYear) -> Dict[str, Class]:
        classes = self.db.query(Class).filter(Class.tenant_id == self.tenant_id, Class.academic_year_id == year.id).all()
        return {(c.name or "").strip().lower(): c for c in classes if c.name}

    def check_rows(self, rows: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """Validate rows; returns (results per row, admissions ready to run)."""
        if len(rows) > MAX_IMPORT_ROWS:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail=f"Import at most {MAX_IMPORT_ROWS} students at a time.")
        year = self.current_year()
        classes = self._classes_by_name(year)
        seen: Dict[str, Dict[str, int]] = {"email": {}, "username": {}, "admission_number": {}}
        guardians: Dict[str, Dict[str, Any]] = {}
        results, admissions = [], []

        for index, raw in enumerate(rows):
            row_number = index + 2  # the header is row 1
            row = {k: _blank(v) for k, v in raw.items()}
            errors: List[str] = []
            for f in ("first_name", "last_name", "class_name"):
                if not row.get(f):
                    errors.append(f"{f.replace('_', ' ').capitalize()} is required")
            gender = (row.get("gender") or "").lower() or None
            if gender and gender not in GENDERS:
                errors.append("Gender must be male, female or other")
            dob = None
            if row.get("date_of_birth"):
                try:
                    dob = date.fromisoformat(row["date_of_birth"][:10])
                except ValueError:
                    errors.append("Date of birth must look like 2018-03-02")
            klass = classes.get((row.get("class_name") or "").lower())
            if row.get("class_name") and not klass:
                errors.append(f"No class named '{row['class_name']}' this school year")
            for key, label in (("email", "email"), ("username", "username"), ("admission_number", "admission number")):
                value = row.get(key)
                if not value:
                    continue
                if key == "email" and not EMAIL_PATTERN.match(value):
                    errors.append("Email doesn't look right")
                if key == "username" and username_problem(value.lower()):
                    errors.append(f"Username {username_problem(value.lower())}")
                lowered = value.lower()
                if lowered in seen[key]:
                    errors.append(f"Same {label} as row {seen[key][lowered]}")
                seen[key].setdefault(lowered, row_number)
                taken = (student_crud.get_by_admission_number(self.db, self.tenant_id, value) is not None
                         if key == "admission_number" else self._taken(getattr(User, key), value))
                if taken:
                    errors.append(f"That {label} is already used in this school")

            guardian = None
            if row.get("guardian_first_name") or row.get("guardian_phone") or row.get("guardian_email"):
                if not (row.get("guardian_first_name") and row.get("guardian_last_name")):
                    errors.append("Guardian first and last name are required")
                key = (row.get("guardian_phone") or row.get("guardian_email") or
                       f"{row.get('guardian_first_name')} {row.get('guardian_last_name')}").lower()
                guardian = guardians.setdefault(key, {
                    "first_name": row.get("guardian_first_name"), "last_name": row.get("guardian_last_name"),
                    "relationship_type": row.get("guardian_relationship") or "guardian",
                    "phone_number": row.get("guardian_phone"), "email": row.get("guardian_email"),
                })

            results.append({"row": row_number, "ok": not errors, "errors": errors})
            if not errors:
                admissions.append({
                    "student": {"first_name": row["first_name"], "last_name": row["last_name"], "gender": gender,
                                "date_of_birth": dob, "email": row.get("email"), "username": row.get("username"),
                                "admission_number": row.get("admission_number")},
                    "guardian_key": key if guardian else None, "guardian": guardian, "class_id": klass.id,
                })
        return results, admissions

    def run_import(self, rows: List[Dict[str, Any]], dry_run: bool) -> Dict[str, Any]:
        results, admissions = self.check_rows(rows)
        valid = all(r["ok"] for r in results)
        if dry_run or not valid:
            return {"valid": valid, "created": 0, "rows": results, "credentials": []}

        credentials: List[Credentials] = []
        created_guardians: Dict[str, Parent] = {}
        for item in admissions:
            key = item["guardian_key"]
            guardian_in = None
            if key and key in created_guardians:
                guardian_in = {"existing_id": created_guardians[key].id}
            elif key:
                guardian_in = item["guardian"]
            result = self.admit(item["student"], guardian_in, item["class_id"])
            if key and result.guardian_created:
                created_guardians[key] = result.guardian
            credentials.extend(result.credentials)
        return {"valid": True, "created": len(admissions), "rows": results,
                "credentials": [c.__dict__ for c in credentials]}
