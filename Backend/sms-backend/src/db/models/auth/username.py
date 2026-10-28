"""Usernames: every account has one, unique per school, so people without email can sign in.

New accounts without a username get one from their name ("ama.kollie", then "ama.kollie2", ...),
whatever code path creates them: the session hook below fills it in before each flush.
"""
import re
import unicodedata
from typing import Iterable, Optional, Set

from sqlalchemy import event, func, select
from sqlalchemy.orm import Session

USERNAME_PATTERN = re.compile(r"^[a-z0-9]+(?:[._-][a-z0-9]+)*$")
USERNAME_MIN, USERNAME_MAX = 3, 50


def _ascii_word(value: Optional[str]) -> str:
    text = unicodedata.normalize("NFKD", value or "").encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "", text.lower())


def username_base(first_name: Optional[str], last_name: Optional[str], email: Optional[str] = None) -> str:
    """'Ama', 'Kollie' -> 'ama.kollie'; falls back to the email's local part, then 'user'."""
    parts = [p for p in (_ascii_word(first_name), _ascii_word(last_name)) if p]
    base = ".".join(parts)
    if len(base) < USERNAME_MIN and email:
        base = ".".join(p for p in re.split(r"[^a-z0-9]+", email.split("@")[0].lower()) if p)
    if len(base) < USERNAME_MIN:
        base = (base + "user") if base else "user"
    return base[: USERNAME_MAX - 4].strip("._-") or "user"


def username_problem(value: str) -> Optional[str]:
    if not USERNAME_MIN <= len(value) <= USERNAME_MAX:
        return f"must be {USERNAME_MIN} to {USERNAME_MAX} characters"
    if not USERNAME_PATTERN.match(value):
        return "may only contain lowercase letters, digits and . _ - between them"
    return None


def first_free(base: str, taken: Iterable[str]) -> str:
    taken = set(taken)
    if base not in taken:
        return base
    n = 2
    while f"{base}{n}" in taken:
        n += 1
    return f"{base}{n}"


def taken_usernames(session: Session, tenant_id, base: str) -> Set[str]:
    from src.db.models.auth.user import User

    with session.no_autoflush:
        rows = session.execute(
            select(func.lower(User.username)).where(
                User.tenant_id == tenant_id, func.lower(User.username).like(f"{base}%")
            )
        ).scalars()
        return set(rows)


def generate_username(session: Session, tenant_id, first_name, last_name, email=None, reserved=()) -> str:
    base = username_base(first_name, last_name, email)
    return first_free(base, taken_usernames(session, tenant_id, base) | set(reserved))


@event.listens_for(Session, "before_flush")
def _assign_usernames(session: Session, flush_context, instances) -> None:
    from src.db.models.auth.user import User

    assigned: dict = {}  # tenant_id -> usernames handed out in this flush
    for obj in list(session.new):
        if not isinstance(obj, User):
            continue
        if obj.username:
            obj.username = obj.username.strip().lower()
            assigned.setdefault(obj.tenant_id, set()).add(obj.username)
            continue
        name = generate_username(
            session, obj.tenant_id, obj.first_name, obj.last_name, obj.email,
            reserved=assigned.get(obj.tenant_id, ()),
        )
        obj.username = name
        assigned.setdefault(obj.tenant_id, set()).add(name)
