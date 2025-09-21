from typing import Any, List, Optional
from uuid import UUID
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from src.services.academics.attendance_service import AttendanceService, SuperAdminAttendanceService
from src.db.session import get_db
from src.schemas.academics.attendance import (
    Attendance, AttendanceCreate, AttendanceUpdate, AttendanceWithDetails,
    AttendanceSummary, BulkAttendanceCreate, AttendanceReport, AttendanceStatus
)
from src.core.middleware.tenant import get_tenant_from_request
from src.core.auth.dependencies import has_any_role, get_current_user, has_permission
from src.schemas.auth import User
from src.core.exceptions.business import (
    BusinessLogicError,
    EntityNotFoundError,
    DuplicateEntityError,
    BusinessRuleViolationError
)

router = APIRouter()

# Core CRUD Endpoints
@router.post("/attendance", response_model=Attendance, status_code=status.HTTP_201_CREATED)
def create_attendance(
    *,
    attendance_service: AttendanceService = Depends(),
    attendance_in: AttendanceCreate,
    current_user: User = Depends(has_any_role(["admin", "teacher"]))
) -> Any:
    """Create a new attendance record (requires admin or teacher role)."""
    try:
        return attendance_service.create(obj_in=attendance_in)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.get("/attendance", response_model=List[Attendance])
def get_attendance_records(
    *,
    attendance_service: AttendanceService = Depends(),
    skip: int = 0,
    limit: int = 100,
    student_id: Optional[UUID] = None,
    class_id: Optional[UUID] = None,
    schedule_id: Optional[UUID] = None,
    academic_year_id: Optional[UUID] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    status_filter: Optional[AttendanceStatus] = None,
    current_user: User = Depends(has_any_role(["admin", "teacher", "student"]))
) -> Any:
    """Get attendance records with optional filtering."""
    try:
        return attendance_service.get_multi(
            skip=skip,
            limit=limit,
            student_id=student_id,
            class_id=class_id,
            schedule_id=schedule_id,
            academic_year_id=academic_year_id,
            start_date=start_date,
            end_date=end_date,
            status_filter=status_filter
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

# Move this route BEFORE the parameterized route
@router.get("/attendance/summary", response_model=AttendanceSummary)
def get_attendance_summary(
    *,
    attendance_service: AttendanceService = Depends(),
    student_id: Optional[UUID] = None,
    class_id: Optional[UUID] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: User = Depends(has_any_role(["admin", "teacher", "student"]))
) -> Any:
    """Get attendance summary statistics."""
    return attendance_service.get_attendance_summary(
        student_id=student_id,
        class_id=class_id,
        start_date=start_date,
        end_date=end_date
    )

@router.get("/attendance/{attendance_id}", response_model=Attendance)
def get_attendance(
    *,
    attendance_service: AttendanceService = Depends(),
    attendance_id: UUID,
    current_user: User = Depends(has_any_role(["admin", "teacher", "student"]))
) -> Any:
    """Get a specific attendance record by ID."""
    attendance = attendance_service.get(id=attendance_id)
    if not attendance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Attendance record with ID {attendance_id} not found"
        )
    return attendance

@router.put("/attendance/{attendance_id}", response_model=Attendance)
def update_attendance(
    *,
    attendance_service: AttendanceService = Depends(),
    attendance_id: UUID,
    attendance_in: AttendanceUpdate,
    current_user: User = Depends(has_any_role(["admin", "teacher"]))
) -> Any:
    """Update an attendance record."""
    try:
        attendance = attendance_service.get(id=attendance_id)
        if not attendance:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Attendance record with ID {attendance_id} not found"
            )
        return attendance_service.update(id=attendance_id, obj_in=attendance_in)
    except BusinessLogicError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.delete("/attendance/{attendance_id}", response_model=Attendance)
def delete_attendance(
    *,
    attendance_service: AttendanceService = Depends(),
    attendance_id: UUID,
    current_user: User = Depends(has_any_role(["admin"]))
) -> Any:
    """Delete an attendance record (admin only)."""
    attendance = attendance_service.get(id=attendance_id)
    if not attendance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Attendance record with ID {attendance_id} not found"
        )
    return attendance_service.delete(id=attendance_id)

# Daily Attendance Management
@router.post("/attendance/mark-daily", response_model=Attendance, status_code=status.HTTP_201_CREATED)
def mark_daily_attendance(
    *,
    attendance_service: AttendanceService = Depends(),
    student_id: UUID,
    class_id: UUID,
    schedule_id: UUID,
    academic_year_id: UUID,
    status: AttendanceStatus,
    attendance_date: Optional[date] = None,
    check_in_time: Optional[datetime] = None,
    check_out_time: Optional[datetime] = None,
    comments: Optional[str] = None,
    current_user: User = Depends(has_any_role(["admin", "teacher"]))
) -> Any:
    """Mark daily attendance for a student."""
    try:
        return attendance_service.mark_daily_attendance(
            student_id=student_id,
            class_id=class_id,
            schedule_id=schedule_id,
            academic_year_id=academic_year_id,
            status=status,
            marked_by=current_user.id,
            attendance_date=attendance_date,
            check_in_time=check_in_time,
            check_out_time=check_out_time,
            comments=comments
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.post("/attendance/bulk-mark", response_model=List[Attendance], status_code=status.HTTP_201_CREATED)
def bulk_mark_attendance(
    *,
    attendance_service: AttendanceService = Depends(),
    attendance_records: List[BulkAttendanceCreate],
    current_user: User = Depends(has_any_role(["admin", "teacher"]))
) -> Any:
    """Bulk mark attendance for multiple students."""
    try:
        # Set marked_by for all records
        for record in attendance_records:
            record.marked_by = current_user.id
        
        return attendance_service.bulk_mark_attendance(attendance_records)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.patch("/attendance/{attendance_id}/status", response_model=Attendance)
def update_attendance_status(
    *,
    attendance_service: AttendanceService = Depends(),
    attendance_id: UUID,
    status: AttendanceStatus,
    check_in_time: Optional[datetime] = None,
    check_out_time: Optional[datetime] = None,
    comments: Optional[str] = None,
    current_user: User = Depends(has_any_role(["admin", "teacher"]))
) -> Any:
    """Update attendance status and related fields."""
    attendance = attendance_service.update_attendance_status(
        attendance_id=attendance_id,
        status=status,
        marked_by=current_user.id,
        check_in_time=check_in_time,
        check_out_time=check_out_time,
        comments=comments
    )
    
    if not attendance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Attendance record with ID {attendance_id} not found"
        )
    
    return attendance

# Query Endpoints
@router.get("/attendance/student/{student_id}/date/{attendance_date}", response_model=Attendance)
def get_student_attendance_by_date(
    *,
    attendance_service: AttendanceService = Depends(),
    student_id: UUID,
    attendance_date: date,
    current_user: User = Depends(has_any_role(["admin", "teacher", "student"]))
) -> Any:
    """Get attendance record for a student on a specific date."""
    attendance = attendance_service.get_by_student_and_date(student_id, attendance_date)
    if not attendance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No attendance record found for student {student_id} on {attendance_date}"
        )
    return attendance

@router.get("/attendance/class/{class_id}/date/{attendance_date}", response_model=List[Attendance])
def get_class_attendance_by_date(
    *,
    attendance_service: AttendanceService = Depends(),
    class_id: UUID,
    attendance_date: date,
    current_user: User = Depends(has_any_role(["admin", "teacher"]))
) -> Any:
    """Get all attendance records for a class on a specific date."""
    return attendance_service.get_by_class_and_date(class_id, attendance_date)

@router.get("/attendance/schedule/{schedule_id}/date/{attendance_date}", response_model=List[Attendance])
def get_schedule_attendance_by_date(
    *,
    attendance_service: AttendanceService = Depends(),
    schedule_id: UUID,
    attendance_date: date,
    current_user: User = Depends(has_any_role(["admin", "teacher"]))
) -> Any:
    """Get all attendance records for a schedule on a specific date."""
    return attendance_service.get_by_schedule_and_date(schedule_id, attendance_date)

@router.get("/attendance/student/{student_id}/range", response_model=List[Attendance])
def get_student_attendance_range(
    *,
    attendance_service: AttendanceService = Depends(),
    student_id: UUID,
    start_date: date,
    end_date: date,
    current_user: User = Depends(has_any_role(["admin", "teacher", "student"]))
) -> Any:
    """Get student attendance records within a date range."""
    return attendance_service.get_student_attendance_range(student_id, start_date, end_date)

@router.get("/attendance/class/{class_id}/range", response_model=List[Attendance])
def get_class_attendance_range(
    *,
    attendance_service: AttendanceService = Depends(),
    class_id: UUID,
    start_date: date,
    end_date: date,
    current_user: User = Depends(has_any_role(["admin", "teacher"]))
) -> Any:
    """Get class attendance records within a date range."""
    return attendance_service.get_class_attendance_range(class_id, start_date, end_date)

# Reporting and Analytics
@router.get("/attendance/summary", response_model=AttendanceSummary)
def get_attendance_summary(
    *,
    attendance_service: AttendanceService = Depends(),
    student_id: Optional[UUID] = None,
    class_id: Optional[UUID] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: User = Depends(has_any_role(["admin", "teacher", "student"]))
) -> Any:
    """Get attendance summary statistics."""
    return attendance_service.get_attendance_summary(
        student_id=student_id,
        class_id=class_id,
        start_date=start_date,
        end_date=end_date
    )

@router.get("/attendance/report", response_model=AttendanceReport)
def generate_attendance_report(
    *,
    attendance_service: AttendanceService = Depends(),
    class_id: Optional[UUID] = None,
    student_id: Optional[UUID] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    report_type: str = "summary",
    current_user: User = Depends(has_any_role(["admin", "teacher"]))
) -> Any:
    """Generate attendance report."""
    return attendance_service.generate_report(
        class_id=class_id,
        student_id=student_id,
        start_date=start_date,
        end_date=end_date,
        report_type=report_type
    )

@router.get("/attendance/absent", response_model=List[Attendance])
def get_absent_students(
    *,
    attendance_service: AttendanceService = Depends(),
    class_id: Optional[UUID] = None,
    attendance_date: Optional[date] = None,
    current_user: User = Depends(has_any_role(["admin", "teacher"]))
) -> Any:
    """Get list of absent students."""
    return attendance_service.get_absent_students(
        class_id=class_id,
        date=attendance_date or date.today()
    )

@router.get("/attendance/late", response_model=List[Attendance])
def get_late_students(
    *,
    attendance_service: AttendanceService = Depends(),
    class_id: Optional[UUID] = None,
    attendance_date: Optional[date] = None,
    current_user: User = Depends(has_any_role(["admin", "teacher"]))
) -> Any:
    """Get list of late students."""
    return attendance_service.get_late_students(
        class_id=class_id,
        date=attendance_date or date.today()
    )

@router.get("/attendance/global-stats", response_model=dict)
def get_global_attendance_stats(
    *,
    super_admin_service: SuperAdminAttendanceService = Depends(),
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: User = Depends(has_any_role(["super_admin"]))
) -> Any:
    """Get global attendance statistics (super admin only)."""
    return super_admin_service.get_global_stats(
        start_date=start_date,
        end_date=end_date
    )

@router.get("/attendance/student/{student_id}/percentage", response_model=dict)
def get_student_attendance_percentage(
    *,
    attendance_service: AttendanceService = Depends(),
    student_id: UUID,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: User = Depends(has_any_role(["admin", "teacher", "student"]))
) -> Any:
    """Calculate student's attendance percentage for a period."""
    percentage = attendance_service.get_student_attendance_percentage(
        student_id=student_id,
        start_date=start_date,
        end_date=end_date
    )
    
    return {
        "student_id": str(student_id),
        "attendance_percentage": percentage,
        "period_start": start_date.isoformat() if start_date else None,
        "period_end": end_date.isoformat() if end_date else None
    }

@router.get("/attendance/class/{class_id}/trends", response_model=dict)
def get_class_attendance_trends(
    *,
    attendance_service: AttendanceService = Depends(),
    class_id: UUID,
    days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(has_any_role(["admin", "teacher"]))
) -> Any:
    """Get attendance trends for a class over specified days."""
    return attendance_service.get_class_attendance_trends(
        class_id=class_id,
        days=days
    )

# # Core CRUD Endpoints - Keep parameterized routes AFTER specific routes
# @router.get("/attendance/{attendance_id}", response_model=Attendance)
# def get_attendance(
#     *,
#     attendance_service: AttendanceService = Depends(),
#     attendance_id: UUID,
#     current_user: User = Depends(has_any_role(["admin", "teacher", "student"]))
# ) -> Any:
#     """Get a specific attendance record by ID."""
#     attendance = attendance_service.get(id=attendance_id)
#     if not attendance:
#         raise HTTPException(
#             status_code=status.HTTP_404_NOT_FOUND,
#             detail=f"Attendance record with ID {attendance_id} not found"
#         )
#     return attendance

# @router.put("/attendance/{attendance_id}", response_model=Attendance)
# def update_attendance(
#     *,
#     attendance_service: AttendanceService = Depends(),
#     attendance_id: UUID,
#     attendance_in: AttendanceUpdate,
#     current_user: User = Depends(has_any_role(["admin", "teacher"]))
# ) -> Any:
#     """Update an attendance record."""
#     try:
#         attendance = attendance_service.get(id=attendance_id)
#         if not attendance:
#             raise HTTPException(
#                 status_code=status.HTTP_404_NOT_FOUND,
#                 detail=f"Attendance record with ID {attendance_id} not found"
#             )
#         return attendance_service.update(id=attendance_id, obj_in=attendance_in)
#     except BusinessLogicError as e:
#         raise HTTPException(
#             status_code=status.HTTP_400_BAD_REQUEST,
#             detail=str(e)
#         )

# @router.delete("/attendance/{attendance_id}", response_model=Attendance)
# def delete_attendance(
#     *,
#     attendance_service: AttendanceService = Depends(),
#     attendance_id: UUID,
#     current_user: User = Depends(has_any_role(["admin"]))
# ) -> Any:
#     """Delete an attendance record (admin only)."""
#     attendance = attendance_service.get(id=attendance_id)
#     if not attendance:
#         raise HTTPException(
#             status_code=status.HTTP_404_NOT_FOUND,
#             detail=f"Attendance record with ID {attendance_id} not found"
#         )
#     return attendance_service.delete(id=attendance_id)

# # Daily Attendance Management
# @router.post("/attendance/mark-daily", response_model=Attendance, status_code=status.HTTP_201_CREATED)
# def mark_daily_attendance(
#     *,
#     attendance_service: AttendanceService = Depends(),
#     student_id: UUID,
#     class_id: UUID,
#     schedule_id: UUID,
#     academic_year_id: UUID,
#     status: AttendanceStatus,
#     attendance_date: Optional[date] = None,
#     check_in_time: Optional[datetime] = None,
#     check_out_time: Optional[datetime] = None,
#     comments: Optional[str] = None,
#     current_user: User = Depends(has_any_role(["admin", "teacher"]))
# ) -> Any:
#     """Mark daily attendance for a student."""
#     try:
#         return attendance_service.mark_daily_attendance(
#             student_id=student_id,
#             class_id=class_id,
#             schedule_id=schedule_id,
#             academic_year_id=academic_year_id,
#             status=status,
#             marked_by=current_user.id,
#             attendance_date=attendance_date,
#             check_in_time=check_in_time,
#             check_out_time=check_out_time,
#             comments=comments
#         )
#     except ValueError as e:
#         raise HTTPException(
#             status_code=status.HTTP_400_BAD_REQUEST,
#             detail=str(e)
#         )

# @router.post("/attendance/bulk-mark", response_model=List[Attendance], status_code=status.HTTP_201_CREATED)
# def bulk_mark_attendance(
#     *,
#     attendance_service: AttendanceService = Depends(),
#     attendance_records: List[BulkAttendanceCreate],
#     current_user: User = Depends(has_any_role(["admin", "teacher"]))
# ) -> Any:
#     """Bulk mark attendance for multiple students."""
#     try:
#         # Set marked_by for all records
#         for record in attendance_records:
#             record.marked_by = current_user.id
        
#         return attendance_service.bulk_mark_attendance(attendance_records)
#     except ValueError as e:
#         raise HTTPException(
#             status_code=status.HTTP_400_BAD_REQUEST,
#             detail=str(e)
#         )

# @router.patch("/attendance/{attendance_id}/status", response_model=Attendance)
# def update_attendance_status(
#     *,
#     attendance_service: AttendanceService = Depends(),
#     attendance_id: UUID,
#     status: AttendanceStatus,
#     check_in_time: Optional[datetime] = None,
#     check_out_time: Optional[datetime] = None,
#     comments: Optional[str] = None,
#     current_user: User = Depends(has_any_role(["admin", "teacher"]))
# ) -> Any:
#     """Update attendance status and related fields."""
#     attendance = attendance_service.update_attendance_status(
#         attendance_id=attendance_id,
#         status=status,
#         marked_by=current_user.id,
#         check_in_time=check_in_time,
#         check_out_time=check_out_time,
#         comments=comments
#     )
    
#     if not attendance:
#         raise HTTPException(
#             status_code=status.HTTP_404_NOT_FOUND,
#             detail=f"Attendance record with ID {attendance_id} not found"
#         )
    
#     return attendance