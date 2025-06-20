from .notification import router as notification_router
from .announcement import router as announcement_router
from .event import router as event_router
from .feedback import router as feedback_router
from .message import router as message_router
from fastapi import APIRouter

router = APIRouter()
router.include_router(notification_router, tags=["notifications"])
router.include_router(announcement_router, tags=["announcements"])
router.include_router(event_router, tags=["events"])
router.include_router(feedback_router, tags=["feedback"])
router.include_router(message_router, tags=["messages"])

__all__ = ["router"]