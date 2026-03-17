from typing import List, Optional
from sqlalchemy.orm import Session
from uuid import UUID
from src.db.crud.base import TenantCRUDBase
from src.db.models.finance.fee_structure import FeeStructure
from src.db.models.finance.fee_category import FeeCategory
from src.db.models.academics.academic_grade import AcademicGrade
from src.schemas.finance.fee_structure import FeeStructureCreate, FeeStructureUpdate

class CRUDFeeStructure(TenantCRUDBase[FeeStructure, FeeStructureCreate, FeeStructureUpdate]):
    def get_multi(
        self, db: Session, *, tenant_id: UUID, skip: int = 0, limit: int = 100
    ) -> List[FeeStructure]:
        query = db.query(self.model).filter(self.model.tenant_id == tenant_id)
        
        # Join with Category and Grade to get names
        results = query.offset(skip).limit(limit).all()
        
        for res in results:
            if res.category_id:
                cat = db.query(FeeCategory).filter(FeeCategory.id == res.category_id).first()
                res.category_name = cat.name if cat else None
            if res.grade_id:
                grd = db.query(AcademicGrade).filter(AcademicGrade.id == res.grade_id).first()
                res.grade_name = grd.name if grd else None
                
        return results

fee_structure = CRUDFeeStructure(FeeStructure)
