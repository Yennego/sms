"""Access rules shared by period attendance and daily (school-day) attendance."""
from datetime import date
from typing import Any, Iterable, Optional, Set
from uuid import UUID

from sqlalchemy.orm import Session

from src.core.exceptions.business import BusinessRuleViolationError, PermissionDeniedError

ADMIN_ROLE_NAMES = {"admin", "superadmin", "super-admin", "super_admin"}


def role_names(user: Any) -> Set[str]:
    return {role.name for role in getattr(user, "roles", [])}


def is_admin(user: Any) -> bool:
    return bool(role_names(user) & ADMIN_ROLE_NAMES)


def class_sponsor_id(db: Session, cls: Any) -> Optional[UUID]:
    """Class.class_teacher_id is the sponsor; fall back to the section's sponsor if unset."""
    from src.db.models.academics.section import Section

    if cls.class_teacher_id is not None:
        return cls.class_teacher_id
    section = db.query(Section).filter(Section.id == cls.section_id).first()
    return section.class_teacher_id if section else None


def check_class_marking_permission(db: Session, cls: Any, user_id: UUID) -> None:
    """Only the class sponsor or an administrator can mark attendance for a class."""
    from src.db.models.auth import User as UserModel

    sponsor_id = class_sponsor_id(db, cls)
    if sponsor_id is not None and str(sponsor_id) == str(user_id):
        return
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user or not is_admin(user):
        raise PermissionDeniedError("mark attendance for", "this class (sponsor or administrator only)")


def enrolled_student_ids(
    db: Session, tenant_id: UUID, cls: Any, student_ids: Optional[Iterable[UUID]] = None
) -> Set[str]:
    """IDs (as str) of students actively enrolled in the class's grade/section for its year.

    Uses the same Enrollment lookup as GET /classes/{class_id}/students, so the
    roster shown to the marker and this check always agree.
    """
    from src.db.models.academics.enrollment import Enrollment

    query = db.query(Enrollment.student_id).filter(
        Enrollment.tenant_id == tenant_id,
        Enrollment.academic_year_id == cls.academic_year_id,
        Enrollment.grade_id == cls.grade_id,
        Enrollment.section_id == cls.section_id,
        Enrollment.is_active == True
    )
    if student_ids is not None:
        query = query.filter(Enrollment.student_id.in_([UUID(str(s)) for s in student_ids]))
    return {str(row.student_id) for row in query.all()}


def check_enrollment(db: Session, tenant_id: UUID, cls: Any, student_ids: Iterable[UUID]) -> None:
    wanted = {str(sid) for sid in student_ids}
    if not wanted:
        return
    missing = wanted - enrolled_student_ids(db, tenant_id, cls, wanted)
    if missing:
        raise BusinessRuleViolationError(
            f"{len(missing)} student(s) are not actively enrolled in this class: {', '.join(sorted(missing))}"
        )


def resolve_viewable_student_id(db: Session, current_user: Any, student_id: Optional[UUID]) -> Optional[UUID]:
    """Limit which student's attendance the caller may read.

    Staff may read anyone; a student only themselves; a parent only their linked children.
    Returns the student_id to filter by (None = no student filter, staff only).
    """
    from src.db.models.people.parent import parent_student

    names = role_names(current_user)
    if names & (ADMIN_ROLE_NAMES | {"teacher"}):
        return student_id
    if "student" in names:
        if student_id and str(student_id) != str(current_user.id):
            raise PermissionDeniedError("view attendance of", "another student")
        return current_user.id
    if "parent" in names:
        child_ids = [
            row.student_id for row in db.query(parent_student.c.student_id)
            .filter(parent_student.c.parent_id == current_user.id).all()
        ]
        if student_id is None:
            if len(child_ids) == 1:
                return child_ids[0]
            raise BusinessRuleViolationError("student_id is required")
        if str(student_id) not in {str(cid) for cid in child_ids}:
            raise PermissionDeniedError("view attendance of", "this student")
        return student_id
    raise PermissionDeniedError("view", "attendance")


def academic_year_for(db: Session, tenant_id: UUID, on_date: date) -> Optional[Any]:
    """The academic year containing on_date (preferring the one marked current)."""
    from src.db.models.academics.academic_year import AcademicYear

    return db.query(AcademicYear).filter(
        AcademicYear.tenant_id == tenant_id,
        AcademicYear.start_date <= on_date,
        AcademicYear.end_date >= on_date
    ).order_by(AcademicYear.is_current.desc()).first()


def has_daily_attendance_history(
    db: Session, tenant_id: UUID, *, student_id: Optional[UUID] = None, user_id: Optional[UUID] = None
) -> bool:
    """Whether school-day attendance references a student, or a user as marker/reviewer/actor.

    Used to block deleting people whose attendance history must be preserved
    (the rows also hold foreign keys to them).
    """
    from sqlalchemy import or_
    from src.db.models.academics.daily_attendance import AttendanceEvent, DailyAttendance

    if student_id is not None:
        if db.query(DailyAttendance.id).filter(
            DailyAttendance.tenant_id == tenant_id, DailyAttendance.student_id == student_id
        ).first() or db.query(AttendanceEvent.id).filter(
            AttendanceEvent.tenant_id == tenant_id, AttendanceEvent.student_id == student_id
        ).first():
            return True
    if user_id is not None:
        if db.query(DailyAttendance.id).filter(
            DailyAttendance.tenant_id == tenant_id,
            or_(DailyAttendance.marked_by == user_id, DailyAttendance.excuse_reviewed_by == user_id)
        ).first() or db.query(AttendanceEvent.id).filter(
            AttendanceEvent.tenant_id == tenant_id, AttendanceEvent.actor_id == user_id
        ).first():
            return True
    return False
