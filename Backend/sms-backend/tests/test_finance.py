import sys
import os
import uuid
from datetime import date, datetime

# Add src to python path for imports
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from sqlalchemy.orm import Session
from src.db.session import SessionLocal
from src.db.models.tenant.tenant import Tenant
from src.db.models.auth.user import User
from src.services.tenant.finance_service import finance_service
from src.schemas.finance.fee_category import FeeCategoryCreate
from src.schemas.finance.fee_structure import FeeStructureCreate
from src.schemas.finance.student_fee import StudentFeeCreate
from src.schemas.finance.fee_payment import FeePaymentCreate
from src.db.crud.finance import fee_category, fee_structure, student_fee, fee_payment

def run_test():
    db: Session = SessionLocal()
    try:
        # Get any existing tenant 
        tenant = db.query(Tenant).first()
        if not tenant:
            print("No tenant found. Database might be empty. Skipping test.")
            return

        # Get any user to act as a student
        student = db.query(User).filter(User.tenant_id == tenant.id).first()
        if not student:
            print("No users found at all to test with. Skip.")
            return

        # 1. Create a Fee Category
        cat_in = FeeCategoryCreate(name=f"Test Tuition {uuid.uuid4().hex[:4]}", description="Term tuition")
        cat = fee_category.create(db, obj_in=cat_in, tenant_id=tenant.id)
        print(f"✅ Created Fee Category: {cat.name} (ID: {cat.id})")

        # 2. Create a Fee Structure
        # Need a dummy academic year first
        from src.db.models.academics.academic_year import AcademicYear
        ay = db.query(AcademicYear).filter(AcademicYear.tenant_id == tenant.id).first()
        if not ay:
            print("No Academic Year found, creating one...")
            ay = AcademicYear(name="2026-2027", start_date=date(2026,1,1), end_date=date(2026,12,31), tenant_id=tenant.id, status="scheduled")
            db.add(ay)
            db.commit()
            db.refresh(ay)

        struct_in = FeeStructureCreate(
            category_id=cat.id,
            academic_year_id=ay.id,
            amount=500.00,
            due_date=date(2026, 12, 1)
        )
        struct = fee_structure.create(db, obj_in=struct_in, tenant_id=tenant.id)
        print(f"✅ Created Fee Structure: ${struct.amount} due {struct.due_date}")

        # 3. Assign Fee to Student
        student_fee_in = StudentFeeCreate(
            fee_structure_id=struct.id,
            student_id=student.id,
            total_amount=struct.amount,
            amount_paid=0.00,
            balance=struct.amount,
            status="PENDING"
        )
        s_fee = student_fee.create(db, obj_in=student_fee_in, tenant_id=tenant.id)
        print(f"✅ Assigned Fee to Student: Balance = ${s_fee.balance}, Status = {s_fee.status}")

        # 4. Record a partial payment
        payment_in = FeePaymentCreate(
            student_fee_id=s_fee.id,
            amount_paid=200.00,
            payment_method="CASH",
            reference_id="RCPT-001"
        )
        payment = finance_service.record_payment(db, tenant_id=tenant.id, payment_in=payment_in)
        print(f"✅ Recorded Payment: ${payment.amount_paid} via {payment.payment_method}")

        # 5. Verify the updated student fee balance
        updated_s_fee = student_fee.get(db, id=s_fee.id, tenant_id=tenant.id)
        print(f"✅ Updated Fee Balance: ${updated_s_fee.balance}, Status = {updated_s_fee.status}")
        
        # Verify summaries
        rev_summary = finance_service.get_revenue_summary(db, tenant_id=tenant.id)
        print(f"✅ Revenue Summary: {rev_summary}")
        
        assert updated_s_fee.balance == 300.00
        assert updated_s_fee.status == "PARTIAL"
        print("🎉 All Backend Finance Logic Tests Passed Successfully!")

    except Exception as e:
        print(f"❌ Test Failed: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    run_test()
