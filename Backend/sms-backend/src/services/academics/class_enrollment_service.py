"""Class enrollments, backed by the one `enrollments` table.

A student has one enrollment per school year and it names their class (enrollments.class_id);
the enrollment's year/grade/section are always the class's. This service keeps the old
"class enrollment" API on top of it:

- enroll in a class: create the year's enrollment with the class (or reactivate a withdrawn or
  completed one into that class);
- move to another class: change class_id (grade/section follow);
- drop: status "withdrawn", inactive, withdrawal_date; reactivate undoes it;
- complete: status "completed", inactive, withdrawal_date.

Changes are flushed, not committed: get_db commits once per request.
"""
from typing import Any, Dict, List, Optional
from uuid import UUID
from datetime import date

from fastapi import Depends
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from src.core.middleware.tenant import get_tenant_from_request
from src.core.redis import cache
from src.db.session import get_db
from src.core.exceptions.business import (
    EntityNotFoundError,
    DuplicateEntityError,
    InvalidStatusTransitionError,
    BusinessRuleViolationError,
)
from src.db.models.academics.class_model import Class
from src.db.models.academics.enrollment import Enrollment
from src.db.crud.people import student as student_crud
from src.db.crud.academics.academic_year_crud import academic_year_crud
from src.schemas.academics.class_enrollment import (
    ClassEnrollment as ClassEnrollmentSchema,
    ClassEnrollmentCreate,
    ClassEnrollmentUpdate,
    BulkClassEnrollmentCreate,
    ClassEnrollmentWithDetails,
)

WITHDRAWN = "withdrawn"
# Old class-enrollment status names accepted as input
STATUS_ALIASES = {"dropped": WITHDRAWN}
LEFT_STATUSES = {WITHDRAWN, "transferred"}
FINISHED_STATUSES = {"completed", "graduated", "promoted"}


def normalize_status(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    value = value.strip().lower()
    return STATUS_ALIASES.get(value, value)


def to_class_enrollment(e: Enrollment) -> ClassEnrollmentSchema:
    """The class-enrollment view of an enrollment."""
    status = e.status or "active"
    return ClassEnrollmentSchema(
        id=e.id,
        tenant_id=e.tenant_id,
        student_id=e.student_id,
        class_id=e.class_id,
        academic_year_id=e.academic_year_id,
        enrollment_date=e.enrollment_date,
        status=status,
        is_active=bool(e.is_active),
        drop_date=e.withdrawal_date if status in LEFT_STATUSES else None,
        completion_date=e.withdrawal_date if status in FINISHED_STATUSES else None,
        created_at=e.created_at,
        updated_at=e.updated_at,
    )


def to_class_enrollment_details(e: Enrollment) -> ClassEnrollmentWithDetails:
    base = to_class_enrollment(e).model_dump()
    return ClassEnrollmentWithDetails(
        **base,
        student_name=e.student.full_name if e.student else "Unknown",
        student_admission_number=e.student.admission_number if e.student else "N/A",
        class_name=e.class_obj.name if e.class_obj else "Unknown",
        academic_year_name=e.academic_year_obj.name if e.academic_year_obj else "N/A",
        enrollment_id=e.id,  # same row now; kept for clients that read it
    )


class ClassEnrollmentService:
    """Enroll students in classes, move them between classes, drop and complete."""

    def __init__(
        self,
        tenant: Any = Depends(get_tenant_from_request),
        db: Session = Depends(get_db),
    ):
        self.db = db
        self.tenant_id = tenant.id if hasattr(tenant, "id") else tenant

    # ---- queries -------------------------------------------------------------------------

    def _query(self):
        return self.db.query(Enrollment).filter(Enrollment.tenant_id == self.tenant_id)

    def _filtered(self, **filters):
        q = self._query()
        if filters.get("class_id"):
            q = q.filter(Enrollment.class_id == filters["class_id"])
        if filters.get("student_id"):
            q = q.filter(Enrollment.student_id == filters["student_id"])
        if filters.get("academic_year_id"):
            q = q.filter(Enrollment.academic_year_id == filters["academic_year_id"])
        if filters.get("status"):
            q = q.filter(Enrollment.status == normalize_status(filters["status"]))
        if filters.get("is_active") is not None:
            q = q.filter(Enrollment.is_active == filters["is_active"])
        return q

    def _get_model(self, id: UUID) -> Optional[Enrollment]:
        return self._query().filter(Enrollment.id == id).first()

    def _require(self, id: UUID) -> Enrollment:
        enroll = self._get_model(id)
        if not enroll:
            raise EntityNotFoundError("ClassEnrollment", id)
        return enroll

    def _class(self, class_id: UUID) -> Class:
        cls = self.db.query(Class).filter(Class.id == class_id, Class.tenant_id == self.tenant_id).first()
        if not cls:
            raise EntityNotFoundError("Class", class_id)
        return cls

    async def get(self, id: UUID) -> Optional[ClassEnrollmentSchema]:
        enroll = self._get_model(id)
        return to_class_enrollment(enroll) if enroll else None

    async def get_multi(self, *, skip: int = 0, limit: int = 100, **filters) -> List[ClassEnrollmentSchema]:
        rows = self._filtered(**filters).order_by(Enrollment.created_at).offset(skip).limit(limit).all()
        return [to_class_enrollment(e) for e in rows]

    async def count(self, **filters) -> int:
        return self._filtered(**filters).count()

    # ---- changes -------------------------------------------------------------------------

    async def _invalidate(self, enroll: Enrollment) -> None:
        # EnrollmentService caches enrollments in Redis
        await cache.delete(f"enrollments:get:id={enroll.id}:tenant={self.tenant_id}")
        await cache.delete(f"enrollments:multi:tenant={self.tenant_id}")
        await cache.delete(f"enrollments:active:student_id={enroll.student_id}:tenant={self.tenant_id}")

    def _flush(self, enroll: Enrollment) -> Enrollment:
        try:
            self.db.add(enroll)
            self.db.flush()  # committed once per request (get_db)
        except IntegrityError:
            raise DuplicateEntityError("Enrollment", "student/academic year", str(enroll.student_id))
        self.db.refresh(enroll)
        return enroll

    def _place_in_class(self, enroll: Enrollment, cls: Class) -> None:
        """Set the class; year/grade/section (and the legacy name mirrors) follow it."""
        enroll.class_obj = cls
        enroll.class_id = cls.id
        enroll.academic_year_id = cls.academic_year_id
        enroll.grade_id = cls.grade_id
        enroll.section_id = cls.section_id
        if cls.academic_year is not None:
            enroll.academic_year = cls.academic_year.name

    def _deactivate_other_years(self, student_id: UUID, keep_year_id: UUID) -> None:
        # Same rule as EnrollmentService.create: one active enrollment per student
        for other in self._query().filter(
            Enrollment.student_id == student_id,
            Enrollment.academic_year_id != keep_year_id,
            Enrollment.is_active == True,  # noqa: E712
        ).all():
            other.is_active = False

    async def enroll_student(self, *, obj_in: ClassEnrollmentCreate) -> ClassEnrollmentSchema:
        if not student_crud.get_by_id(self.db, tenant_id=self.tenant_id, id=obj_in.student_id):
            raise EntityNotFoundError("Student", obj_in.student_id)
        cls = self._class(obj_in.class_id)
        if not academic_year_crud.get_by_id(self.db, tenant_id=self.tenant_id, id=obj_in.academic_year_id):
            raise EntityNotFoundError("AcademicYear", obj_in.academic_year_id)
        if cls.academic_year_id != obj_in.academic_year_id:
            raise BusinessRuleViolationError("The class belongs to a different academic year")

        existing = self._query().filter(
            Enrollment.student_id == obj_in.student_id,
            Enrollment.academic_year_id == obj_in.academic_year_id,
        ).first()
        status = normalize_status(obj_in.status) or "active"

        if existing and existing.is_active and existing.status == "active":
            if existing.class_id == cls.id:
                raise DuplicateEntityError("ClassEnrollment", "unique_student_class_year", "already enrolled in this class")
            raise DuplicateEntityError(
                "ClassEnrollment", "unique_enrollment_student_year",
                "already enrolled in another class this year; move the enrollment instead",
            )

        if existing:
            # Withdrawn/completed earlier this year: reactivate into this class
            enroll = existing
            enroll.status = "active"
            enroll.is_active = True
            enroll.withdrawal_date = None
            enroll.withdrawal_reason = None
            if obj_in.enrollment_date:
                enroll.enrollment_date = obj_in.enrollment_date
        else:
            enroll = Enrollment(
                tenant_id=self.tenant_id,
                student_id=obj_in.student_id,
                enrollment_date=obj_in.enrollment_date or date.today(),
                status=status,
                is_active=status == "active",
                semester=1,
            )
            self.db.add(enroll)
        self._place_in_class(enroll, cls)
        if enroll.is_active:
            self._deactivate_other_years(obj_in.student_id, cls.academic_year_id)
        enroll = self._flush(enroll)
        await self._invalidate(enroll)
        return to_class_enrollment(enroll)

    async def bulk_enroll_students(self, *, bulk_data: BulkClassEnrollmentCreate) -> Dict[str, List[Any]]:
        cls = self._class(bulk_data.class_id)
        if not academic_year_crud.get_by_id(self.db, tenant_id=self.tenant_id, id=bulk_data.academic_year_id):
            raise EntityNotFoundError("AcademicYear", bulk_data.academic_year_id)

        created: List[ClassEnrollmentSchema] = []
        failed: List[Dict[str, Any]] = []
        for student_id in bulk_data.student_ids:
            if not student_crud.get_by_id(self.db, tenant_id=self.tenant_id, id=student_id):
                failed.append({"student_id": student_id, "error": "Student not found"})
                continue
            obj = ClassEnrollmentCreate(
                student_id=student_id,
                class_id=cls.id,
                academic_year_id=bulk_data.academic_year_id,
                enrollment_date=bulk_data.enrollment_date,
                status=bulk_data.status or "active",
            )
            try:
                with self.db.begin_nested():  # one student's failure doesn't undo the others
                    created.append(await self.enroll_student(obj_in=obj))
            except DuplicateEntityError:
                failed.append({"student_id": student_id, "error": "duplicate"})
            except Exception as e:
                failed.append({"student_id": student_id, "error": str(e)})
        return {"created": created, "failed": failed}

    async def move_to_class(self, *, enrollment_id: UUID, class_id: UUID) -> ClassEnrollmentSchema:
        enroll = self._require(enrollment_id)
        cls = self._class(class_id)
        if cls.academic_year_id != enroll.academic_year_id:
            raise BusinessRuleViolationError("A student can only move to a class of the same academic year")
        self._place_in_class(enroll, cls)
        enroll = self._flush(enroll)
        await self._invalidate(enroll)
        return to_class_enrollment(enroll)

    async def update(self, *, id: UUID, obj_in: ClassEnrollmentUpdate) -> ClassEnrollmentSchema:
        enroll = self._require(id)
        data = obj_in.model_dump(exclude_unset=True)

        if data.get("class_id") and data["class_id"] != enroll.class_id:
            await self.move_to_class(enrollment_id=id, class_id=data["class_id"])
        if "enrollment_date" in data and data["enrollment_date"]:
            enroll.enrollment_date = data["enrollment_date"]
        if data.get("status"):
            enroll.status = normalize_status(data["status"])
        if "is_active" in data and data["is_active"] is not None:
            enroll.is_active = data["is_active"]
        for key in ("drop_date", "completion_date"):
            if key in data:
                enroll.withdrawal_date = data[key]

        enroll = self._flush(enroll)
        await self._invalidate(enroll)
        return to_class_enrollment(enroll)

    async def delete(self, *, id: UUID) -> Optional[ClassEnrollmentSchema]:
        """Delete the student's enrollment for the year (it has no other class row any more)."""
        enroll = self._get_model(id)
        if not enroll:
            return None
        result = to_class_enrollment(enroll)
        try:
            with self.db.begin_nested():
                self.db.delete(enroll)
        except IntegrityError:
            raise BusinessRuleViolationError(
                "This enrollment has grades or other records; withdraw the student instead of deleting"
            )
        await self._invalidate(enroll)
        return result

    remove = delete

    async def drop_student_from_class(self, *, enrollment_id: UUID, drop_date: Optional[date] = None) -> ClassEnrollmentSchema:
        enroll = self._require(enrollment_id)
        if enroll.status in FINISHED_STATUSES:
            raise InvalidStatusTransitionError("ClassEnrollment", enroll.status, WITHDRAWN)
        if isinstance(drop_date, str):
            drop_date = date.fromisoformat(drop_date)
        enroll.status = WITHDRAWN
        enroll.is_active = False
        enroll.withdrawal_date = drop_date or date.today()
        enroll = self._flush(enroll)
        await self._invalidate(enroll)
        return to_class_enrollment(enroll)

    async def complete_student_enrollment(self, *, enrollment_id: UUID, completion_date: Optional[date] = None) -> ClassEnrollmentSchema:
        enroll = self._require(enrollment_id)
        if isinstance(completion_date, str):
            completion_date = date.fromisoformat(completion_date)
        enroll.status = "completed"
        enroll.is_active = False
        enroll.withdrawal_date = completion_date or date.today()
        enroll = self._flush(enroll)
        await self._invalidate(enroll)
        return to_class_enrollment(enroll)

    async def reactivate_enrollment(self, *, enrollment_id: UUID) -> ClassEnrollmentSchema:
        enroll = self._require(enrollment_id)
        if enroll.status not in LEFT_STATUSES:
            raise InvalidStatusTransitionError("ClassEnrollment", enroll.status, "active")
        enroll.status = "active"
        enroll.is_active = True
        enroll.withdrawal_date = None
        enroll.withdrawal_reason = None
        self._deactivate_other_years(enroll.student_id, enroll.academic_year_id)
        enroll = self._flush(enroll)
        await self._invalidate(enroll)
        return to_class_enrollment(enroll)

    # ---- class rosters -------------------------------------------------------------------

    def _with_details(self):
        return self._query().options(
            joinedload(Enrollment.student),
            joinedload(Enrollment.class_obj),
            joinedload(Enrollment.academic_year_obj),
        )

    async def get_students_in_class(
        self,
        *,
        class_id: UUID,
        academic_year_id: Optional[UUID] = None,
        is_active: Optional[bool] = True,
        skip: int = 0,
        limit: int = 200,
    ) -> List[ClassEnrollmentWithDetails]:
        """Students in a class with names, in one query."""
        q = self._with_details().filter(Enrollment.class_id == class_id)
        if academic_year_id:
            q = q.filter(Enrollment.academic_year_id == academic_year_id)
        if is_active is not None:
            q = q.filter(Enrollment.is_active == is_active)
        rows = q.order_by(Enrollment.created_at).offset(skip).limit(limit).all()
        return [to_class_enrollment_details(e) for e in rows]

    async def get_student_classes(
        self,
        *,
        student_id: UUID,
        academic_year_id: Optional[UUID] = None,
        is_active: Optional[bool] = True,
    ) -> List[ClassEnrollmentSchema]:
        q = self._filtered(student_id=student_id, academic_year_id=academic_year_id, is_active=is_active)
        return [to_class_enrollment(e) for e in q.all()]

    async def get_class_enrollment_count(
        self,
        *,
        class_id: UUID,
        academic_year_id: Optional[UUID] = None,
        is_active: Optional[bool] = None,
        status: Optional[str] = None,
    ) -> int:
        return self._filtered(
            class_id=class_id, academic_year_id=academic_year_id, is_active=is_active, status=status
        ).count()

    async def get_with_details(self, *, id: UUID) -> Optional[ClassEnrollmentWithDetails]:
        enroll = self._with_details().filter(Enrollment.id == id).first()
        return to_class_enrollment_details(enroll) if enroll else None
