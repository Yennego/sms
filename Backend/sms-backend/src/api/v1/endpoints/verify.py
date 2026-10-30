"""Public report card check (docs/remodel/phase4-design.md §7). Listed in PUBLIC_ROUTES.

No school is in the session: the code is looked up with a platform session and only that card's
listed fields are returned. Unknown and malformed codes get the same "not_found" answer.
Rate-limited per client address.
"""
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from src.core.security.client_ip import client_ip
from src.db.session import get_super_admin_db
from src.services.academics import report_card_verification_service as rcv

router = APIRouter()

TOO_MANY = HTTPException(
    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
    detail="Too many checks from this address. Please wait a few minutes and try again.",
)


async def _rate_limit(request: Request) -> None:
    if await rcv.hit(client_ip(request)) > rcv.VERIFY_PER_IP:
        raise TOO_MANY


@router.get("/report-cards/{code}", dependencies=[Depends(_rate_limit)])
def verify_report_card(code: str, db: Session = Depends(get_super_admin_db)) -> Any:
    return rcv.public_result(db, code)
