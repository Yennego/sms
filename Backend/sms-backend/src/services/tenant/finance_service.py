from typing import Any, Dict
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from src.db.models.finance.expenditure import Expenditure
from src.services.finance.ledger import CURRENCIES, ZERO, money


class FinanceService:
    """Expenses. School fees live in src/services/finance/fee_service.py."""

    @staticmethod
    def get_expenditure_summary(db: Session, tenant_id: UUID) -> Dict[str, Any]:
        """Total spent per currency, as strings with two decimals (never a float, never USD + LRD)."""
        rows = (db.query(Expenditure.currency, func.sum(Expenditure.amount))
                .filter(Expenditure.tenant_id == tenant_id)
                .group_by(Expenditure.currency).all())
        totals = {currency: total for currency, total in rows}
        return {"total_spent": {c: money(totals.get(c) or ZERO) for c in CURRENCIES}}


finance_service = FinanceService()
