"""QR ID-card scanning and printing.

Mounted before attendance_api: otherwise /attendance/{attendance_id} would capture
/attendance/id-cards.
"""
from typing import Any, List
from uuid import UUID

from fastapi import APIRouter, Depends

from src.core.auth.dependencies import has_any_role
from src.schemas.auth import User
from src.schemas.academics.attendance_scan import IdCard, ManualCheckInRequest, ScanRequest, ScanResult
from src.services.academics.attendance_scan_service import SCANNER_ROLE, AttendanceScanService
from src.services.base.rate_limit import rate_limit

router = APIRouter()

SCAN_ROLES = ["admin", "teacher", SCANNER_ROLE]


@router.post(
    "/attendance/scan",
    response_model=ScanResult,
    dependencies=[Depends(rate_limit(limit=120, period=60))],
)
def scan_card(
    *,
    service: AttendanceScanService = Depends(),
    scan_in: ScanRequest,
    current_user: User = Depends(has_any_role(SCAN_ROLES))
) -> Any:
    """Check a student in (or out) by ID card. Always 200: `result` is accepted,
    duplicate or rejected (with `reason`), so the scanner screen can show it.
    Optional scanned_at / client_scan_id: for scans queued while offline (see ScanRequest)."""
    return service.scan(scan_in.token, scan_in.mode, scan_in.device_label, current_user,
                        scanned_at=scan_in.scanned_at, client_scan_id=scan_in.client_scan_id)


@router.post(
    "/attendance/scan/manual",
    response_model=ScanResult,
    dependencies=[Depends(rate_limit(limit=120, period=60))],
)
def manual_check_in(
    *,
    service: AttendanceScanService = Depends(),
    check_in: ManualCheckInRequest,
    current_user: User = Depends(has_any_role(SCAN_ROLES))
) -> Any:
    """Check a student in by admission number when their card can't be read (logged as manual)."""
    return service.manual_check_in(check_in.admission_number, check_in.device_label, current_user,
                                   scanned_at=check_in.scanned_at, client_scan_id=check_in.client_scan_id)


@router.get("/attendance/id-cards", response_model=List[IdCard])
def get_class_id_cards(
    *,
    service: AttendanceScanService = Depends(),
    class_id: UUID,
    current_user: User = Depends(has_any_role(["admin"]))
) -> Any:
    """Printable ID cards (with QR) for every student enrolled in a class."""
    return service.class_cards(class_id, current_user)


@router.get("/attendance/id-cards/{student_id}", response_model=IdCard)
def get_student_id_card(
    *,
    service: AttendanceScanService = Depends(),
    student_id: UUID,
    current_user: User = Depends(has_any_role(["admin"]))
) -> Any:
    return service.student_card(student_id, current_user)


@router.post("/attendance/id-cards/{student_id}/reissue", response_model=IdCard)
def reissue_student_id_card(
    *,
    service: AttendanceScanService = Depends(),
    student_id: UUID,
    current_user: User = Depends(has_any_role(["admin"]))
) -> Any:
    """Issue a new card; every older card for this student stops working immediately."""
    return service.reissue_card(student_id, current_user)
