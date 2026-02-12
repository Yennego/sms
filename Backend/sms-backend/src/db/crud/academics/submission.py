from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_
from uuid import UUID

from src.db.crud.base import TenantCRUDBase
from src.db.models.academics.submission import Submission
from src.schemas.academics.submission import SubmissionCreate, SubmissionUpdate

class CRUDSubmission(TenantCRUDBase[Submission, SubmissionCreate, SubmissionUpdate]):
    def get_by_assignment_and_student(
        self, db: Session, *, assignment_id: UUID, student_id: UUID, tenant_id: UUID
    ) -> Optional[Submission]:
        return db.query(self.model).filter(
            and_(
                self.model.assignment_id == assignment_id,
                self.model.student_id == student_id,
                self.model.tenant_id == tenant_id
            )
        ).first()

    def get_multi_by_assignment(
        self, db: Session, *, assignment_id: UUID, tenant_id: UUID, skip: int = 0, limit: int = 100
    ) -> List[Submission]:
        return db.query(self.model).filter(
            and_(
                self.model.assignment_id == assignment_id,
                self.model.tenant_id == tenant_id
            )
        ).offset(skip).limit(limit).all()

    def get_multi_by_student(
        self, db: Session, *, student_id: UUID, tenant_id: UUID, skip: int = 0, limit: int = 100
    ) -> List[Submission]:
        return db.query(self.model).filter(
            and_(
                self.model.student_id == student_id,
                self.model.tenant_id == tenant_id
            )
        ).offset(skip).limit(limit).all()

    def create_with_tenant(
        self, db: Session, *, obj_in: SubmissionCreate, tenant_id: UUID, extra_data: Optional[dict] = None
    ) -> Submission:
        """Create a new submission with tenant_id and optional extra data."""
        # Convert Pydantic model to dict
        from fastapi.encoders import jsonable_encoder
        obj_in_data = jsonable_encoder(obj_in)
        
        # Add tenant_id
        obj_in_data["tenant_id"] = tenant_id
        
        # Add extra data (like student_id)
        if extra_data:
            obj_in_data.update(extra_data)
            
        db_obj = self.model(**obj_in_data)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

submission = CRUDSubmission(Submission)
