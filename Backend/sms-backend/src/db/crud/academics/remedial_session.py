from sqlalchemy.orm import Session
from uuid import UUID
from typing import List
from src.db.crud.base import TenantCRUDBase
from src.db.models.academics.remedial_session import RemedialSession
from src.schemas.academics.promotion import RemedialSessionCreate, RemedialSessionUpdate

class CRUDRemedialSession(TenantCRUDBase[RemedialSession, RemedialSessionCreate, RemedialSessionUpdate]):
    def list_by_enrollment(self, db: Session, *, tenant_id: UUID, enrollment_id: UUID) -> List[dict]:
        from src.db.models.academics.subject import Subject
        results = db.query(RemedialSession, Subject.name.label("subject_name")).join(
            Subject, RemedialSession.subject_id == Subject.id
        ).filter(
            RemedialSession.tenant_id == tenant_id, 
            RemedialSession.enrollment_id == enrollment_id
        ).all()
        
        output = []
        for session, subject_name in results:
            d = {c.name: getattr(session, c.name) for c in session.__table__.columns}
            d["subject_name"] = subject_name
            output.append(d)
        return output

remedial_session_crud = CRUDRemedialSession(RemedialSession)