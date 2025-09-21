from typing import List, Optional, Dict, Any
from uuid import UUID

from sqlalchemy.orm import Session

from src.db.models.academics.academic_grade import AcademicGrade
from src.db.crud.base import TenantCRUDBase
from src.schemas.academics.academic_grade import AcademicGradeCreate, AcademicGradeUpdate


class CRUDAcademicGrade(TenantCRUDBase[AcademicGrade, AcademicGradeCreate, AcademicGradeUpdate]):
    def get_by_name(self, db: Session, *, tenant_id: UUID, name: str) -> Optional[AcademicGrade]:
        return db.query(AcademicGrade).filter(AcademicGrade.tenant_id == tenant_id, AcademicGrade.name == name).first()
    
    def get_active_grades(self, db: Session, *, tenant_id: UUID, skip: int = 0, limit: int = 100) -> List[AcademicGrade]:
        return db.query(AcademicGrade).filter(
            AcademicGrade.tenant_id == tenant_id, 
            AcademicGrade.is_active == True
        ).order_by(AcademicGrade.sequence).offset(skip).limit(limit).all()


academic_grade = CRUDAcademicGrade(AcademicGrade)

