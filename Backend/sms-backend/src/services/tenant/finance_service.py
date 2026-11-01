from typing import Any, Dict
from uuid import UUID
from decimal import Decimal

from sqlalchemy.orm import Session

from src.db.crud.finance import expenditure


class FinanceService:
    """Expenses. School fees live in src/services/finance/fee_service.py."""

    @staticmethod
    def get_expenditure_summary(db: Session, tenant_id: UUID) -> Dict[str, Any]:
        """Total spent, as a string with two decimals (never a float)."""
        all_expenditures = expenditure.get_multi(db, tenant_id=tenant_id, limit=10000)
        total_spent = sum((exp.amount or Decimal('0')) for exp in all_expenditures)
        return {"total_spent": f"{Decimal(total_spent).quantize(Decimal('0.01')):.2f}"}


finance_service = FinanceService()
