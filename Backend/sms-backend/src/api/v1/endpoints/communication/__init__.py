from .inbox import router as inbox_router
from .event import router as event_router
from .feedback import router as feedback_router
from .message import router as message_router
from fastapi import APIRouter

router = APIRouter()
# Inbox, email switches, announcements and the delivery log (phase6-design.md §5)
router.include_router(inbox_router, tags=["communication"])
router.include_router(event_router, tags=["events"])
router.include_router(feedback_router, tags=["feedback"])
router.include_router(message_router, tags=["messages"])

__all__ = ["router"]
