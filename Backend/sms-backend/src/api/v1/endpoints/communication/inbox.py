"""Communication API (docs/remodel/phase6-design.md §4-§5), mounted at /api/v1/communication.

Permissions per endpoint (§4): the inbox and email switches are the caller's own (any signed-in
user); announcements are listed and sent by the service's rules (send_announcements, or a teacher
for classes they teach or sponsor); withdrawing needs the author or send_announcements; the
delivery log and retries need manage_tenant_settings.
"""
from datetime import date
from typing import Any, List, Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from src.core.auth.dependencies import get_current_active_user, has_permission
from src.core.middleware.tenant import get_tenant_id_from_request
from src.db.session import get_db
from src.services.communication.communication_service import MAX_PAGE_SIZE, CommunicationService

router = APIRouter()

DELIVERY_LOG = has_permission("manage_tenant_settings")


def _service(db: Session = Depends(get_db), tenant_id=Depends(get_tenant_id_from_request),
             user=Depends(get_current_active_user)) -> CommunicationService:
    return CommunicationService(db=db, tenant_id=tenant_id, user=user)


class PreferenceIn(BaseModel):
    event: Literal["attendance_absent", "attendance_late", "results_published", "payment_received", "announcement"]
    email: bool


class AnnouncementIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=5000)
    audience: Literal["all", "role", "class", "family"]
    audience_role: Optional[Literal["parents", "students", "teachers", "staff"]] = None
    class_id: Optional[UUID] = None
    student_id: Optional[UUID] = None


# --- inbox ---------------------------------------------------------------------------------------

@router.get("/inbox")
def inbox(unread_only: bool = False, page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=MAX_PAGE_SIZE),
          service: CommunicationService = Depends(_service)) -> Any:
    return service.inbox(unread_only=unread_only, page=page, page_size=page_size)


@router.get("/inbox/unread-count")
def unread_count(service: CommunicationService = Depends(_service)) -> Any:
    return {"unread": service.unread()}


@router.post("/inbox/read-all")
def read_all(service: CommunicationService = Depends(_service)) -> Any:
    return service.mark_all_read()


@router.post("/inbox/{notification_id}/read")
def read_one(notification_id: UUID, service: CommunicationService = Depends(_service)) -> Any:
    return service.mark_read(notification_id)


# --- email switches ------------------------------------------------------------------------------

@router.get("/preferences")
def get_preferences(service: CommunicationService = Depends(_service)) -> Any:
    return service.preferences()


@router.put("/preferences")
def put_preferences(body: List[PreferenceIn], service: CommunicationService = Depends(_service)) -> Any:
    return service.update_preferences([p.model_dump() for p in body])


# --- announcements -------------------------------------------------------------------------------

@router.get("/announcements")
def list_announcements(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=MAX_PAGE_SIZE),
                       service: CommunicationService = Depends(_service)) -> Any:
    return service.list_announcements(page=page, page_size=page_size)


@router.get("/announcements/audiences")
def announcement_audiences(service: CommunicationService = Depends(_service)) -> Any:
    return service.audiences()


@router.post("/announcements")
def send_announcement(body: AnnouncementIn, service: CommunicationService = Depends(_service)) -> Any:
    return service.send(body.model_dump())


@router.post("/announcements/{announcement_id}/withdraw")
def withdraw_announcement(announcement_id: UUID, service: CommunicationService = Depends(_service)) -> Any:
    return service.withdraw(announcement_id)


# --- delivery log --------------------------------------------------------------------------------

@router.get("/deliveries")
def list_deliveries(status: Optional[Literal["queued", "sent", "failed", "skipped"]] = None,
                    channel: Optional[Literal["email", "sms"]] = None,
                    date_from: Optional[date] = Query(None, alias="from"), date_to: Optional[date] = Query(None, alias="to"),
                    page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=MAX_PAGE_SIZE),
                    _=Depends(DELIVERY_LOG), service: CommunicationService = Depends(_service)) -> Any:
    return service.deliveries(status_filter=status, channel=channel, date_from=date_from, date_to=date_to,
                              page=page, page_size=page_size)


@router.post("/deliveries/{delivery_id}/retry")
def retry_delivery(delivery_id: UUID, _=Depends(DELIVERY_LOG), service: CommunicationService = Depends(_service)) -> Any:
    return service.retry(delivery_id)
