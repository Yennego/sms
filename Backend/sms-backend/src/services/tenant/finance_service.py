from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from uuid import UUID
from datetime import date, datetime
from decimal import Decimal

from src.db.crud.finance import fee_category, fee_structure, student_fee, fee_installment, fee_payment, expense_category, expenditure
from src.schemas.finance.fee_category import FeeCategoryCreate
from src.schemas.finance.fee_structure import FeeStructureCreate
from src.schemas.finance.student_fee import StudentFeeCreate
from src.schemas.finance.fee_installment import FeeInstallmentCreate
from src.schemas.finance.fee_payment import FeePaymentCreate
from src.schemas.finance.expense_category import ExpenseCategoryCreate
from src.schemas.finance.expenditure import ExpenditureCreate

class FinanceService:
    """Service layer for handling finance-related business logic."""

    @staticmethod
    def get_revenue_summary(db: Session, tenant_id: UUID) -> Dict[str, Any]:
        """Get summary of total revenue, collected, and pending amounts."""
        # Calculate totals from student_fees
        all_fees = student_fee.get_multi(db, tenant_id=tenant_id, limit=10000)
        
        total_expected = sum((fee.total_amount or Decimal('0')) for fee in all_fees)
        total_collected = sum((fee.amount_paid or Decimal('0')) for fee in all_fees)
        total_pending = sum((fee.balance or Decimal('0')) for fee in all_fees)
        
        return {
            "total_expected": float(total_expected),
            "total_collected": float(total_collected),
            "total_pending": float(total_pending)
        }

    @staticmethod
    def get_expenditure_summary(db: Session, tenant_id: UUID) -> Dict[str, Any]:
        """Get summary of total expenditures."""
        all_expenditures = expenditure.get_multi(db, tenant_id=tenant_id, limit=10000)
        total_spent = sum((exp.amount or Decimal('0')) for exp in all_expenditures)
        
        return {
            "total_spent": float(total_spent)
        }

    @staticmethod
    def record_payment(db: Session, tenant_id: UUID, payment_in: FeePaymentCreate) -> Any:
        """Record a fee payment and update the student fee balance."""
        # Create payment record
        payment = fee_payment.create(db, obj_in=payment_in, tenant_id=tenant_id)
        
        # Update the student fee balance
        fee = student_fee.get_by_id(db, tenant_id=tenant_id, id=payment_in.student_fee_id)
        if fee:
            new_amount_paid = fee.amount_paid + payment_in.amount_paid
            new_balance = fee.total_amount - new_amount_paid
            
            # Determine new status
            if new_balance <= 0:
                new_status = "PAID"
            elif new_amount_paid > 0:
                new_status = "PARTIAL"
            else:
                new_status = "PENDING"
                
            student_fee.update(db, tenant_id=tenant_id, db_obj=fee, obj_in={"amount_paid": new_amount_paid, "balance": new_balance, "status": new_status})
            
        return payment

    @staticmethod
    def get_fees_export_data(db: Session, tenant_id: UUID) -> List[Dict[str, Any]]:
        """Get flattened data for fee export."""
        # Use a larger limit for export data
        fees = student_fee.get_multi(db, tenant_id=tenant_id, limit=5000)
        
        export_data = []
        for fee in fees:
            # Safely handle potential None values
            total_amount = float(fee.total_amount) if fee.total_amount is not None else 0.0
            amount_paid = float(fee.amount_paid) if fee.amount_paid is not None else 0.0
            balance = float(fee.balance) if fee.balance is not None else 0.0
            
            export_data.append({
                "Student": getattr(fee, "student_name", "Unknown") or "Unknown",
                "Category": getattr(fee, "category_name", "N/A") or "N/A",
                "Total Amount ($)": total_amount,
                "Paid ($)": amount_paid,
                "Balance ($)": balance,
                "Status": fee.status or "PENDING",
                "Created At": fee.created_at.strftime("%Y-%m-%d") if getattr(fee, "created_at", None) else "N/A"
            })
            
        return export_data

finance_service = FinanceService()
