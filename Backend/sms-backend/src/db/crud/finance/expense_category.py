from src.db.crud.base import TenantCRUDBase
from src.db.models.finance.expense_category import ExpenseCategory
from src.schemas.finance.expense_category import ExpenseCategoryCreate, ExpenseCategoryUpdate

class CRUDExpenseCategory(TenantCRUDBase[ExpenseCategory, ExpenseCategoryCreate, ExpenseCategoryUpdate]):
    pass

expense_category = CRUDExpenseCategory(ExpenseCategory)
