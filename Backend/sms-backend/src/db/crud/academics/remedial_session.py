from sqlalchemy.orm import Session
from uuid import UUID
from typing import List, Optional
from src.db.crud.base import TenantCRUDBase
from src.db.models.academics.remedial_session import RemedialSession
from src.schemas.academics.promotion import RemedialSessionCreate, RemedialSessionUpdate

class CRUDRemedialSession(TenantCRUDBase[RemedialSession, RemedialSessionCreate, RemedialSessionUpdate]):
    def list_with_names(self, db: Session, *, tenant_id: UUID, enrollment_id: Optional[UUID] = None,
                        skip: int = 0, limit: int = 100) -> List[dict]:
        """Sessions with the student's and subject's names (one query; newest first)."""
        from src.db.models.academics.subject import Subject
        from src.db.models.auth.user import User
        query = (
            db.query(RemedialSession, Subject.name, User.first_name, User.last_name)
            .outerjoin(Subject, RemedialSession.subject_id == Subject.id)
            .outerjoin(User, RemedialSession.student_id == User.id)
            .filter(RemedialSession.tenant_id == tenant_id)
        )
        if enrollment_id:
            query = query.filter(RemedialSession.enrollment_id == enrollment_id)
        rows = query.order_by(RemedialSession.scheduled_date.desc()).offset(skip).limit(limit).all()
        output = []
        for session, subject_name, first, last in rows:
            d = {c.name: getattr(session, c.name) for c in session.__table__.columns}
            d["subject_name"] = subject_name
            d["student_name"] = " ".join(n for n in (first, last) if n) or None
            output.append(d)
        return output

    def list_by_enrollment(self, db: Session, *, tenant_id: UUID, enrollment_id: UUID) -> List[dict]:
        return self.list_with_names(db, tenant_id=tenant_id, enrollment_id=enrollment_id, limit=1000)


remedial_session_crud = CRUDRemedialSession(RemedialSession)