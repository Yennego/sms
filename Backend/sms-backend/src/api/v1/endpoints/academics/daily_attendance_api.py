"""School-day attendance, attendance settings and the school calendar.

Mounted before attendance_api: otherwise GET /attendance/{attendance_id}
would capture /attendance/daily, /attendance/settings and /attendance/calendar.
"""
from datetime import date
from typing import Any, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from src.core.auth.dependencies import has_any_role
from src.schemas.auth import User
from src.db.models.academics.daily_attendance import ExcuseStatus
from src.schemas.academics.daily_attendance import (
    AttendanceEventRead, AttendanceSettingsRead, AttendanceSettingsUpdate, ChildSummary, ClassAttendanceReport,
    CloseDayResult, DailyOverview,
    DailyAttendanceRead, DailyBulkSet, DailyRoster, DailyStatusSet, ExcuseDocumentOut, ExcuseListItem,
    ExcuseReview, ExcuseWithDocument, ParentExcuseCreate, SchoolCalendarDayRead, SchoolCalendarDayUpsert,
    SchoolDayInfo, StudentDailyHistory
)
from src.services.academics.attendance_excuse_service import AttendanceExcuseService
from src.services.academics.attendance_report_service import AttendanceReportService
from src.services.academics.daily_attendance_service import DailyAttendanceService

router = APIRouter()


# --- Settings & calendar -------------------------------------------------------------

@router.get("/attendance/settings", response_model=AttendanceSettingsRead)
def get_attendance_settings(
    *,
    service: DailyAttendanceService = Depends(),
    current_user: User = Depends(has_any_role(["admin", "teacher"]))
) -> Any:
    """Attendance rules for this school (defaults if never saved)."""
    return service.get_settings()


@router.put("/attendance/settings", response_model=AttendanceSettingsRead)
def update_attendance_settings(
    *,
    service: DailyAttendanceService = Depends(),
    settings_in: AttendanceSettingsUpdate,
    current_user: User = Depends(has_any_role(["admin"]))
) -> Any:
    return service.update_settings(settings_in)


@router.get("/attendance/calendar", response_model=List[SchoolCalendarDayRead])
def list_calendar_days(
    *,
    service: DailyAttendanceService = Depends(),
    start_date: date,
    end_date: date,
    current_user: User = Depends(has_any_role(["admin", "teacher"]))
) -> Any:
    """Holidays and make-up days between two dates."""
    return service.list_calendar(start_date, end_date)


@router.get("/attendance/calendar/day-info", response_model=SchoolDayInfo)
def get_day_info(
    *,
    service: DailyAttendanceService = Depends(),
    day: Optional[date] = Query(None, alias="date"),
    current_user: User = Depends(has_any_role(["admin", "teacher"]))
) -> Any:
    """Whether a date is a school day (defaults to school-local today)."""
    return service.day_info(day or service.school_today())


@router.put("/attendance/calendar/{day}", response_model=SchoolCalendarDayRead)
def set_calendar_day(
    *,
    service: DailyAttendanceService = Depends(),
    day: date,
    day_in: SchoolCalendarDayUpsert,
    current_user: User = Depends(has_any_role(["admin"]))
) -> Any:
    """Mark a date as a holiday (is_school_day=false) or a make-up school day (true)."""
    return service.set_calendar_day(day, day_in)


@router.delete("/attendance/calendar/{day}", status_code=status.HTTP_204_NO_CONTENT)
def delete_calendar_day(
    *,
    service: DailyAttendanceService = Depends(),
    day: date,
    current_user: User = Depends(has_any_role(["admin"]))
) -> None:
    service.delete_calendar_day(day)


# --- Daily attendance ----------------------------------------------------------------

@router.get("/attendance/daily", response_model=DailyRoster)
def get_daily_roster(
    *,
    service: DailyAttendanceService = Depends(),
    class_id: UUID,
    day: Optional[date] = Query(None, alias="date"),
    current_user: User = Depends(has_any_role(["admin", "teacher"]))
) -> Any:
    """Class roster for a day with each student's record (null = not marked yet).
    After the auto-absent cut-off, unmarked students are recorded absent."""
    return service.get_roster(class_id, day, current_user)


@router.post("/attendance/daily/bulk", response_model=List[DailyAttendanceRead])
def bulk_set_daily(
    *,
    service: DailyAttendanceService = Depends(),
    bulk_in: DailyBulkSet,
    current_user: User = Depends(has_any_role(["admin", "teacher"]))
) -> Any:
    """Save a whole roster in one transaction (class sponsor or admin)."""
    return service.bulk_set(bulk_in, current_user)


@router.post("/attendance/daily/close-day", response_model=CloseDayResult)
def close_day(
    *,
    service: DailyAttendanceService = Depends(),
    day: Optional[date] = Query(None, alias="date"),
    current_user: User = Depends(has_any_role(["admin"]))
) -> Any:
    """Mark every unmarked student absent for a finished school day. Safe to repeat."""
    day = day or service.school_today()
    return CloseDayResult(date=day, marked_absent=service.close_day(day, current_user))


@router.get("/attendance/daily/overview", response_model=DailyOverview)
def get_daily_overview(
    *,
    service: AttendanceReportService = Depends(),
    day: Optional[date] = Query(None, alias="date"),
    current_user: User = Depends(has_any_role(["admin"]))
) -> Any:
    """Whole school for one day (default today): totals, per-class counts, pending excuses."""
    return service.overview(day, current_user)


@router.get("/attendance/daily/report", response_model=ClassAttendanceReport)
def get_class_daily_report(
    *,
    service: AttendanceReportService = Depends(),
    class_id: UUID,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: User = Depends(has_any_role(["admin", "teacher"]))
) -> Any:
    """Per-student totals for a class over a date range (default: academic year to date)."""
    return service.class_report(class_id, start_date, end_date, current_user)


@router.get("/attendance/daily/my-children", response_model=List[ChildSummary])
def get_my_children(
    *,
    service: AttendanceExcuseService = Depends(),
    current_user: User = Depends(has_any_role(["parent"]))
) -> Any:
    """The signed-in parent's linked children."""
    return service.my_children(current_user)


@router.post("/attendance/daily/excuses", response_model=DailyAttendanceRead, status_code=status.HTTP_201_CREATED)
def submit_parent_excuse(
    *,
    service: AttendanceExcuseService = Depends(),
    excuse_in: ParentExcuseCreate,
    current_user: User = Depends(has_any_role(["parent"]))
) -> Any:
    """A parent reports an absence (up to 14 days back or 30 days ahead). Pending until reviewed."""
    return service.submit_parent_excuse(excuse_in, current_user)


@router.get("/attendance/daily/excuses", response_model=List[ExcuseListItem])
def list_excuses(
    *,
    service: AttendanceExcuseService = Depends(),
    excuse_status: Optional[ExcuseStatus] = Query(ExcuseStatus.PENDING, alias="status"),
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: User = Depends(has_any_role(["admin"]))
) -> Any:
    """Excuses for review (pending by default)."""
    return service.list_excuses(current_user, excuse_status, start_date, end_date)


@router.get("/attendance/daily/student/{student_id}", response_model=StudentDailyHistory)
def get_student_daily_history(
    *,
    service: DailyAttendanceService = Depends(),
    student_id: UUID,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: User = Depends(has_any_role(["admin", "teacher", "student", "parent"]))
) -> Any:
    from src.db.models.people.student import Student

    start, end, summary, records = service.student_history(student_id, start_date, end_date, current_user)
    student = service.db.get(Student, student_id)  # existence and access checked above
    return StudentDailyHistory(
        student_id=student_id, student_name=f"{student.first_name} {student.last_name}".strip(),
        admission_number=student.admission_number,
        start_date=start, end_date=end, summary=summary, records=records
    )


@router.put("/attendance/daily/{student_id}", response_model=DailyAttendanceRead)
def set_daily_status(
    *,
    service: DailyAttendanceService = Depends(),
    student_id: UUID,
    day: Optional[date] = Query(None, alias="date"),
    status_in: DailyStatusSet,
    current_user: User = Depends(has_any_role(["admin", "teacher"]))
) -> Any:
    """Manually set one student's status (sponsor of their class or admin). A manual mark always wins."""
    return service.set_status(student_id, day, status_in, current_user)


@router.put("/attendance/daily/{daily_id}/excuse", response_model=DailyAttendanceRead)
def set_excuse(
    *,
    service: AttendanceExcuseService = Depends(),
    daily_id: UUID,
    excuse_in: ExcuseWithDocument,
    current_user: User = Depends(has_any_role(["admin", "teacher"]))
) -> Any:
    """Record an excuse (pre-approved when entered by staff), optionally with a document."""
    return service.set_excuse_with_document(daily_id, excuse_in, current_user)


@router.get("/attendance/daily/{daily_id}/excuse/document", response_model=ExcuseDocumentOut)
def get_excuse_document(
    *,
    service: AttendanceExcuseService = Depends(),
    daily_id: UUID,
    current_user: User = Depends(has_any_role(["admin", "teacher", "student", "parent"]))
) -> Any:
    """The excuse's supporting document, base64-encoded."""
    return service.get_document(daily_id, current_user)


@router.post("/attendance/daily/{daily_id}/excuse/review", response_model=DailyAttendanceRead)
def review_excuse(
    *,
    service: DailyAttendanceService = Depends(),
    daily_id: UUID,
    review_in: ExcuseReview,
    current_user: User = Depends(has_any_role(["admin"]))
) -> Any:
    """Approve or reject a pending excuse."""
    return service.review_excuse(daily_id, review_in, current_user)


@router.get("/attendance/daily/{daily_id}/events", response_model=List[AttendanceEventRead])
def list_daily_events(
    *,
    service: DailyAttendanceService = Depends(),
    daily_id: UUID,
    current_user: User = Depends(has_any_role(["admin", "teacher"]))
) -> Any:
    """Audit trail for one record: every scan, change and excuse, oldest first."""
    return [
        AttendanceEventRead.model_validate(event).model_copy(update={"actor_name": actor_name})
        for event, actor_name in service.list_events(daily_id, current_user)
    ]
