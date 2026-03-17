from src.db.crud.base import TenantCRUDBase
from src.db.models.finance.fee_installment import FeeInstallment
from src.schemas.finance.fee_installment import FeeInstallmentCreate, FeeInstallmentUpdate

from src.db.models.finance.student_fee import StudentFee
from src.db.models.people.student import Student
from src.db.models.finance.fee_structure import FeeStructure
from src.db.models.finance.fee_category import FeeCategory
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

class CRUDFeeInstallment(TenantCRUDBase[FeeInstallment, FeeInstallmentCreate, FeeInstallmentUpdate]):
    def get_multi(
        self, db: Session, *, tenant_id: UUID, skip: int = 0, limit: int = 100, filters: dict = None
    ) -> List[FeeInstallment]:
        query = db.query(self.model).filter(self.model.tenant_id == tenant_id)
        if filters:
            for key, value in filters.items():
                if hasattr(self.model, key):
                    query = query.filter(getattr(self.model, key) == value)
        
        results = query.offset(skip).limit(limit).all()
        
        for res in results:
            # Join StudentFee -> Student
            student_fee = db.query(StudentFee).filter(StudentFee.id == res.student_fee_id).first()
            if student_fee:
                student = db.query(Student).filter(Student.id == student_fee.student_id).first()
                if student:
                    res.student_name = f"{student.first_name} {student.last_name}"
                
                # Join FeeStructure -> FeeCategory
                structure = db.query(FeeStructure).filter(FeeStructure.id == student_fee.fee_structure_id).first()
                if structure:
                    category = db.query(FeeCategory).filter(FeeCategory.id == structure.category_id).first()
                    res.category_name = category.name if category else None
                    
        return results

fee_installment = CRUDFeeInstallment(FeeInstallment)
