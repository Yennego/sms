from typing import List, Optional, Dict, Any
from uuid import UUID

from sqlalchemy.orm import Session

from src.db.models.academics.subject import Subject
from src.db.crud.base import CRUDBase


class CRUDSubject(CRUDBase[Subject, Dict[str, Any], Dict[str, Any]]):
    def get_by_code(self, db: Session, *, tenant_id: UUID, code: str) -> Optional[Subject]:
        return db.query(Subject).filter(Subject.tenant_id == tenant_id, Subject.code == code).first()
    
    def get_active_subjects(self, db: Session, *, tenant_id: UUID, skip: int = 0, limit: int = 100) -> List[Subject]:
        return db.query(Subject).filter(Subject.tenant_id == tenant_id, Subject.is_active == True).offset(skip).limit(limit).all()


subject = CRUDSubject(Subject)

