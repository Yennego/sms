from typing import List, Optional
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session
from uuid import UUID
from src.db.crud.base import TenantCRUDBase
from src.db.models.finance.student_fee import StudentFee
from src.db.models.finance.fee_installment import FeeInstallment
from src.db.models.finance.fee_structure import FeeStructure
from src.db.models.finance.fee_category import FeeCategory
from src.db.models.people.student import Student
from src.db.models.academics.enrollment import Enrollment
from src.schemas.finance.student_fee import StudentFeeCreate, StudentFeeUpdate, BulkStudentFeeCreate

class CRUDStudentFee(TenantCRUDBase[StudentFee, StudentFeeCreate, StudentFeeUpdate]):
    def get_multi(
        self, db: Session, *, tenant_id: UUID, skip: int = 0, limit: int = 100
    ) -> List[StudentFee]:
        from sqlalchemy.orm import joinedload
        
        query = db.query(self.model).filter(self.model.tenant_id == tenant_id)
        
        # Use joinedload to fetch relationships in the same query
        query = query.options(
            joinedload(StudentFee.student),
            joinedload(StudentFee.fee_structure).joinedload(FeeStructure.category)
        )
        
        results = query.offset(skip).limit(limit).all()
        
        for res in results:
            # Populate student name if relationship exists
            if res.student:
                res.student_name = f"{res.student.first_name} {res.student.last_name}"
            
            # Populate category name via structure relationship
            if res.fee_structure and res.fee_structure.category:
                res.category_name = res.fee_structure.category.name
                    
        return results

    def create(self, db: Session, tenant_id: any, *, obj_in: StudentFeeCreate) -> StudentFee:
        """Create a student fee and its optional installments."""
        tenant_id = self._ensure_uuid(tenant_id)
        
        # Extract installments if present
        obj_in_data = jsonable_encoder(obj_in)
        installments_data = obj_in_data.pop("installments", [])
        
        # Add tenant_id
        obj_in_data["tenant_id"] = tenant_id
        
        # Create student fee
        db_obj = self.model(**obj_in_data)
        db.add(db_obj)
        db.flush() # Flush to get the ID for installments
        
        # Create installments
        for inst_data in (installments_data or []):
            inst_data["tenant_id"] = tenant_id
            inst_data["student_fee_id"] = db_obj.id
            db_installment = FeeInstallment(**inst_data)
            db.add(db_installment)
            
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def create_bulk(self, db: Session, tenant_id: any, *, obj_in: BulkStudentFeeCreate) -> dict:
        """Apply a fee structure to all students in the structure's grade level."""
        tenant_id = self._ensure_uuid(tenant_id)
        
        # 1. Fetch the structure
        structure = db.query(FeeStructure).filter(
            FeeStructure.id == obj_in.fee_structure_id,
            FeeStructure.tenant_id == tenant_id
        ).first()
        
        if not structure:
            return {"count": 0, "skipped": 0, "error": "Structure not found"}
            
        # 2. Get active students in that grade and year
        enrollments = db.query(Enrollment).filter(
            Enrollment.tenant_id == tenant_id,
            Enrollment.grade_id == structure.grade_id,
            Enrollment.academic_year_id == structure.academic_year_id,
            Enrollment.is_active == True
        ).all()
        
        count = 0
        skipped = 0
        
        for enrollment in enrollments:
            # 3. Check if existence
            existing = db.query(StudentFee).filter(
                StudentFee.tenant_id == tenant_id,
                StudentFee.student_id == enrollment.student_id,
                StudentFee.fee_structure_id == structure.id
            ).first()
            
            if existing:
                skipped += 1
                continue
                
            # 4. Create StudentFee
            new_fee = StudentFee(
                tenant_id=tenant_id,
                student_id=enrollment.student_id,
                fee_structure_id=structure.id,
                total_amount=structure.amount,
                balance=structure.amount,
                status="PENDING"
            )
            db.add(new_fee)
            db.flush()
            
            # 5. Create installments
            if obj_in.installments:
                for inst_data in obj_in.installments:
                    db_inst = FeeInstallment(
                        tenant_id=tenant_id,
                        student_fee_id=new_fee.id,
                        amount=inst_data.amount,
                        due_date=inst_data.due_date,
                        status="PENDING"
                    )
                    db.add(db_inst)
            
            count += 1
            
        db.commit()
        return {"count": count, "skipped": skipped}

student_fee = CRUDStudentFee(StudentFee)
