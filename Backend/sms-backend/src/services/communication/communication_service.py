"""Communication (docs/remodel/phase6-design.md §4-§5): the inbox, email switches, announcements
and the delivery log.

Rules:
- every lookup filters by the request's school; ids from another school (or another user's
  notifications) are 404;
- announcements: send_announcements may target everyone, a role, any class of the current school
  year or one family; a teacher (no permission needed) only classes they teach a subject in or
  sponsor. Each recipient gets an inbox notification (and an email copy, see notify.py);
  withdrawing removes those notifications and their unsent copies;
- the delivery log and retries need manage_tenant_settings (the endpoint checks it);
- changes are flushed only: the request commits once.
"""
from datetime import date, datetime, time, timedelta, UTC
from math import ceil
from typing import Any, Dict, Iterable, List, Optional, Set
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from src.core.security.auth import SUPER_ADMIN_ROLE_NAMES, is_super_admin
from src.db.models.academics.academic_year import AcademicYear
from src.db.models.academics.class_model import Class
from src.db.models.academics.class_subject import ClassSubject
from src.db.models.auth.user import User
from src.db.models.auth.user_role import UserRole, user_role_association
from src.db.models.communication.announcement import AUDIENCE_ROLES, AUDIENCES, Announcement
from src.db.models.communication.notification import (
    CHANNELS, DELIVERY_STATUSES, EVENTS, Notification, NotificationDelivery, NotificationPreference,
)
from src.db.models.people.student import Student
from src.services.academics import results_service as rs
from src.services.academics.attendance_access import class_sponsor_id
from src.services.notification.alerts import parents_of
from src.services.notification.notify import EVENT_LABELS, notify
from src.services.notification.senders import SmtpEmailSender

MAX_PAGE_SIZE = 100
ROLE_LABELS = {"parents": "Parents", "students": "Students", "teachers": "Teachers", "staff": "Staff"}
# User.type of each role audience; "staff" is everyone who isn't a student or a parent
ROLE_TYPES = {"parents": ("parent",), "students": ("student",), "teachers": ("teacher",)}


def _now() -> datetime:
    """Current time (UTC). Tests replace it."""
    return datetime.now(UTC)


def _404(what: str):
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{what} not found")


def _422(detail: Any):
    return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=detail)


def _409(detail: Any):
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail)


def _403(detail: str):
    return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


def _uuid(value) -> Optional[UUID]:
    if value is None or isinstance(value, UUID):
        return value
    return UUID(str(value))


def _name(user) -> Optional[str]:
    if user is None:
        return None
    return f"{user.first_name or ''} {user.last_name or ''}".strip() or getattr(user, "username", None)


def _aware(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=UTC)  # SQLite returns naive UTC


def _page(page: int, page_size: int):
    page = max(int(page or 1), 1)
    page_size = min(max(int(page_size or 20), 1), MAX_PAGE_SIZE)
    return page, page_size


def _paged(items: List[Any], total: int, page: int, page_size: int) -> Dict[str, Any]:
    return {"items": items, "total": total, "page": page, "page_size": page_size,
            "pages": max(ceil(total / page_size), 1) if page_size else 1}


def user_permissions(user: Any) -> set:
    return {p.name for role in getattr(user, "roles", []) for p in role.permissions}


class CommunicationService:
    def __init__(self, db: Session, tenant_id, user: Any):
        self.db = db
        self.tenant_id = _uuid(tenant_id)
        self.user = user
        self.super = is_super_admin(user) if user is not None else False
        self.perms = user_permissions(user)

    def can(self, permission: str) -> bool:
        return self.super or permission in self.perms

    # --- inbox ----------------------------------------------------------------------------------

    def _mine(self):
        return self.db.query(Notification).filter(Notification.tenant_id == self.tenant_id,
                                                   Notification.user_id == self.user.id)

    def unread(self) -> int:
        return self._mine().filter(Notification.read_at.is_(None)).count()

    @staticmethod
    def _notification_out(n: Notification) -> Dict[str, Any]:
        return {"id": n.id, "event": n.event, "title": n.title, "body": n.body, "link": n.link,
                "created_at": _aware(n.created_at), "read_at": _aware(n.read_at)}

    def inbox(self, unread_only: bool = False, page: int = 1, page_size: int = 20) -> Dict[str, Any]:
        page, page_size = _page(page, page_size)
        query = self._mine()
        if unread_only:
            query = query.filter(Notification.read_at.is_(None))
        total = query.count()
        rows = (query.order_by(Notification.created_at.desc(), Notification.id.desc())
                .offset((page - 1) * page_size).limit(page_size).all())
        out = _paged([self._notification_out(n) for n in rows], total, page, page_size)
        out["unread"] = self.unread()
        return out

    def mark_read(self, notification_id) -> Dict[str, int]:
        n = self._mine().filter(Notification.id == _uuid(notification_id)).first()
        if n is None:
            raise _404("Notification")
        if n.read_at is None:
            n.read_at = _now()
            self.db.flush()
        return {"unread": self.unread()}

    def mark_all_read(self) -> Dict[str, int]:
        self._mine().filter(Notification.read_at.is_(None)).update({Notification.read_at: _now()},
                                                                    synchronize_session=False)
        self.db.flush()
        return {"unread": 0}

    # --- preferences ----------------------------------------------------------------------------

    def preferences(self) -> Dict[str, Any]:
        off = {r[0] for r in self.db.query(NotificationPreference.event).filter(
            NotificationPreference.tenant_id == self.tenant_id, NotificationPreference.user_id == self.user.id,
            NotificationPreference.channel == "email", NotificationPreference.enabled == False)}  # noqa: E712
        return {"email": self.user.email or None, "email_configured": SmtpEmailSender().configured(),
                "items": [{"event": e, "label": EVENT_LABELS[e], "email": e not in off} for e in EVENTS]}

    def update_preferences(self, items: Iterable[Dict[str, Any]]) -> Dict[str, Any]:
        items = list(items)
        unknown = [i.get("event") for i in items if i.get("event") not in EVENTS]
        if unknown:
            raise _422(f"Unknown events: {', '.join(map(str, unknown))}")
        rows = {r.event: r for r in self.db.query(NotificationPreference).filter(
            NotificationPreference.tenant_id == self.tenant_id, NotificationPreference.user_id == self.user.id,
            NotificationPreference.channel == "email")}
        for item in items:
            row = rows.get(item["event"])
            if row is None:
                row = NotificationPreference(tenant_id=self.tenant_id, user_id=self.user.id, event=item["event"],
                                             channel="email")
                self.db.add(row)
                rows[item["event"]] = row
            row.enabled = bool(item["email"])
        self.db.flush()
        return self.preferences()

    # --- announcements: who may target what -----------------------------------------------------

    def _current_year(self) -> Optional[AcademicYear]:
        return self.db.query(AcademicYear).filter(AcademicYear.tenant_id == self.tenant_id,
                                                  AcademicYear.is_current == True).first()  # noqa: E712

    def _classes(self, year: Optional[AcademicYear]) -> List[Class]:
        if year is None:
            return []
        return self.db.query(Class).filter(Class.tenant_id == self.tenant_id,
                                           Class.academic_year_id == year.id).order_by(Class.name).all()

    def _teaches(self, cls: Class, taught: Set[UUID]) -> bool:
        if cls.id in taught:
            return True
        sponsor = class_sponsor_id(self.db, cls)
        return sponsor is not None and str(sponsor) == str(self.user.id)

    def _taught_class_ids(self) -> Set[UUID]:
        return {r[0] for r in self.db.query(ClassSubject.class_id).filter(
            ClassSubject.tenant_id == self.tenant_id, ClassSubject.teacher_id == self.user.id)}

    def own_classes(self) -> List[Class]:
        """Classes of the current school year the caller teaches a subject in or sponsors."""
        taught = self._taught_class_ids()
        return [c for c in self._classes(self._current_year()) if self._teaches(c, taught)]

    def audiences(self) -> Dict[str, Any]:
        if self.can("send_announcements"):
            classes = self._classes(self._current_year())
            return {"roles": list(AUDIENCE_ROLES), "classes": [{"id": c.id, "name": c.name} for c in classes],
                    "family": True}
        return {"roles": [], "classes": [{"id": c.id, "name": c.name} for c in self.own_classes()], "family": False}

    # --- announcements: recipients --------------------------------------------------------------

    def _school_users(self):
        """Active users of the school, without platform super-admins."""
        supers = (self.db.query(user_role_association.c.user_id)
                  .join(UserRole, UserRole.id == user_role_association.c.role_id)
                  .filter(UserRole.name.in_(SUPER_ADMIN_ROLE_NAMES), UserRole.tenant_id.is_(None)))
        return self.db.query(User.id).filter(User.tenant_id == self.tenant_id, User.is_active == True,  # noqa: E712
                                             User.id.notin_(supers))

    def _with_parents(self, student_ids: Iterable) -> Set[UUID]:
        ids = {_uuid(s) for s in student_ids}
        out = set(ids)
        for parents in parents_of(self.db, self.tenant_id, ids).values():
            out.update(parents)
        return out

    def _recipients(self, a: Announcement) -> Set[UUID]:
        if a.audience == "all":
            ids = {r[0] for r in self._school_users()}
        elif a.audience == "role":
            query = self._school_users()
            types = ROLE_TYPES.get(a.audience_role)
            query = query.filter(User.type.in_(types)) if types else query.filter(User.type.notin_(("student", "parent")))
            ids = {r[0] for r in query}
        elif a.audience == "class":
            ids = self._with_parents(e.student_id for e in rs.class_roster(self.db, self.tenant_id, a.class_id,
                                                                           active_only=True))
        else:
            ids = self._with_parents([a.student_id])
        ids.discard(self.user.id)  # the author sees it in their list, not their inbox
        return ids

    # --- announcements: list, send, withdraw ----------------------------------------------------

    def _audience_label(self, a: Announcement, classes: Dict[UUID, str], students: Dict[UUID, Student]) -> str:
        if a.audience == "all":
            return "Everyone"
        if a.audience == "role":
            return ROLE_LABELS.get(a.audience_role, a.audience_role)
        if a.audience == "class":
            return f"Class {classes.get(a.class_id, '')}".strip()
        return f"Family of {_name(students.get(a.student_id)) or 'a student'}"

    def _announcements_out(self, rows: List[Announcement]) -> List[Dict[str, Any]]:
        classes = dict(self.db.query(Class.id, Class.name).filter(
            Class.id.in_({a.class_id for a in rows if a.class_id} or {None})).all())
        students = {s.id: s for s in self.db.query(Student).filter(
            Student.id.in_({a.student_id for a in rows if a.student_id} or {None}))}
        authors = {u.id: u for u in self.db.query(User).filter(User.id.in_({a.author_id for a in rows} or {None}))}
        return [{"id": a.id, "title": a.title, "body": a.body, "audience": a.audience,
                 "audience_role": a.audience_role, "class_id": a.class_id, "student_id": a.student_id,
                 "audience_label": self._audience_label(a, classes, students),
                 "author_id": a.author_id, "author_name": _name(authors.get(a.author_id)),
                 "sent_at": _aware(a.sent_at), "withdrawn_at": _aware(a.withdrawn_at),
                 "recipient_count": a.recipient_count, "can_withdraw": self.may_withdraw(a)}
                for a in rows]

    def may_withdraw(self, a: Announcement) -> bool:
        return a.withdrawn_at is None and (self.can("send_announcements") or str(a.author_id) == str(self.user.id))

    def list_announcements(self, page: int = 1, page_size: int = 20) -> Dict[str, Any]:
        page, page_size = _page(page, page_size)
        query = self.db.query(Announcement).filter(Announcement.tenant_id == self.tenant_id)
        if not self.can("send_announcements"):
            received = [k.split(":", 1)[1] for (k,) in self._mine().filter(
                Notification.event == "announcement").with_entities(Notification.source_key)]
            query = query.filter(or_(Announcement.author_id == self.user.id,
                                     Announcement.id.in_([_uuid(i) for i in received] or [None])))
        total = query.count()
        rows = (query.order_by(Announcement.sent_at.desc(), Announcement.id.desc())
                .offset((page - 1) * page_size).limit(page_size).all())
        return _paged(self._announcements_out(rows), total, page, page_size)

    def _get(self, announcement_id) -> Announcement:
        a = self.db.query(Announcement).filter(Announcement.tenant_id == self.tenant_id,
                                               Announcement.id == _uuid(announcement_id)).first()
        if a is None:
            raise _404("Announcement")
        return a

    def send(self, data: Dict[str, Any]) -> Dict[str, Any]:
        title, body = (data.get("title") or "").strip(), (data.get("body") or "").strip()
        if not title or not body:
            raise _422("Give a title and a message")
        audience = data.get("audience")
        if audience not in AUDIENCES:
            raise _422("audience must be all, role, class or family")
        full = self.can("send_announcements")
        a = Announcement(tenant_id=self.tenant_id, title=title[:200], body=body, audience=audience,
                         author_id=self.user.id, sent_at=_now(), recipient_count=0)
        if audience == "class":
            cls = self.db.query(Class).filter(Class.tenant_id == self.tenant_id,
                                              Class.id == _uuid(data.get("class_id"))).first()
            if cls is None:
                raise _404("Class")
            if not full and not self._teaches(cls, self._taught_class_ids()):
                raise _403("You can only send announcements to classes you teach or sponsor")
            a.class_id = cls.id
        elif not full:
            raise _403("You can only send announcements to classes you teach or sponsor")
        elif audience == "role":
            if data.get("audience_role") not in AUDIENCE_ROLES:
                raise _422("audience_role must be parents, students, teachers or staff")
            a.audience_role = data["audience_role"]
        elif audience == "family":
            student = self.db.query(Student).filter(Student.tenant_id == self.tenant_id,
                                                    Student.id == _uuid(data.get("student_id"))).first()
            if student is None:
                raise _404("Student")
            a.student_id = student.id
        self.db.add(a)
        self.db.flush()
        recipients = self._recipients(a)
        a.recipient_count = notify(self.db, self.tenant_id, event="announcement", recipients=recipients,
                                   title=a.title, body=a.body, data={"announcement_id": str(a.id)},
                                   source_key=f"announcement:{a.id}")
        self.db.flush()
        return self._announcements_out([a])[0]

    def withdraw(self, announcement_id) -> Dict[str, Any]:
        a = self._get(announcement_id)
        if a.withdrawn_at is not None:
            raise _409("This announcement is already withdrawn")
        if not self.may_withdraw(a):
            raise _403("Only the author or someone who can send announcements can withdraw it")
        a.withdrawn_at = _now()
        a.withdrawn_by = self.user.id
        # Gone from inboxes, with its email copies (sent ones can't be recalled; their log goes too)
        ids = [r[0] for r in self.db.query(Notification.id).filter(
            Notification.tenant_id == self.tenant_id, Notification.event == "announcement",
            Notification.source_key == f"announcement:{a.id}")]
        if ids:
            self.db.query(NotificationDelivery).filter(NotificationDelivery.tenant_id == self.tenant_id,
                                                       NotificationDelivery.notification_id.in_(ids)
                                                       ).delete(synchronize_session=False)
            self.db.query(Notification).filter(Notification.id.in_(ids)).delete(synchronize_session=False)
        self.db.flush()
        return self._announcements_out([a])[0]

    # --- delivery log ---------------------------------------------------------------------------

    def _day_bounds(self, start: Optional[date], end: Optional[date]):
        from src.services.finance.fee_service import school_timezone
        tz = school_timezone(self.db, self.tenant_id)
        lo = datetime.combine(start, time.min, tz).astimezone(UTC) if start else None
        hi = datetime.combine(end + timedelta(days=1), time.min, tz).astimezone(UTC) if end else None
        return lo, hi

    def deliveries(self, *, status_filter: Optional[str] = None, channel: Optional[str] = None,
                   date_from: Optional[date] = None, date_to: Optional[date] = None, page: int = 1,
                   page_size: int = 25) -> Dict[str, Any]:
        if status_filter and status_filter not in DELIVERY_STATUSES:
            raise _422("status must be queued, sent, failed or skipped")
        if channel and channel not in CHANNELS:
            raise _422("channel must be email or sms")
        page, page_size = _page(page, page_size)
        base = (self.db.query(NotificationDelivery, Notification, User)
                .join(Notification, and_(Notification.id == NotificationDelivery.notification_id,
                                         Notification.tenant_id == NotificationDelivery.tenant_id))
                .outerjoin(User, User.id == Notification.user_id)
                .filter(NotificationDelivery.tenant_id == self.tenant_id))
        if channel:
            base = base.filter(NotificationDelivery.channel == channel)
        lo, hi = self._day_bounds(date_from, date_to)
        if lo:
            base = base.filter(NotificationDelivery.created_at >= lo)
        if hi:
            base = base.filter(NotificationDelivery.created_at < hi)
        counts = {s: 0 for s in DELIVERY_STATUSES}
        for s, n in (base.with_entities(NotificationDelivery.status, func.count(NotificationDelivery.id))
                     .group_by(NotificationDelivery.status)):
            counts[s] = n
        query = base.filter(NotificationDelivery.status == status_filter) if status_filter else base
        total = query.count()
        rows = (query.order_by(NotificationDelivery.created_at.desc(), NotificationDelivery.id.desc())
                .offset((page - 1) * page_size).limit(page_size).all())
        out = _paged([self._delivery_out(d, n, u) for d, n, u in rows], total, page, page_size)
        out["counts"] = counts
        return out

    @staticmethod
    def _delivery_out(d: NotificationDelivery, n: Notification, u: Optional[User]) -> Dict[str, Any]:
        return {"id": d.id, "channel": d.channel, "status": d.status, "attempts": d.attempts,
                "last_error": d.last_error, "created_at": _aware(d.created_at), "sent_at": _aware(d.sent_at),
                "recipient_name": _name(u), "recipient_email": u.email if u else None,
                "event": n.event, "title": n.title}

    def retry(self, delivery_id) -> Dict[str, Any]:
        row = (self.db.query(NotificationDelivery, Notification, User)
               .join(Notification, Notification.id == NotificationDelivery.notification_id)
               .outerjoin(User, User.id == Notification.user_id)
               .filter(NotificationDelivery.tenant_id == self.tenant_id,
                       NotificationDelivery.id == _uuid(delivery_id)).first())
        if row is None:
            raise _404("Delivery")
        d, n, u = row
        if d.status not in ("failed", "skipped"):
            raise _409("Only failed or skipped deliveries can be retried")
        d.status, d.attempts, d.next_attempt_at, d.last_error = "queued", 0, None, None
        d.updated_at = _now()
        self.db.flush()
        return self._delivery_out(d, n, u)
