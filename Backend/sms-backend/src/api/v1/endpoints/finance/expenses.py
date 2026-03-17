from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID

from src.db.session import get_db
from src.core.security.auth import get_current_active_user
from src.core.middleware.tenant import get_tenant_id_from_request
from src.db.models.auth.user import User
from src.services.tenant.finance_service import finance_service
from src.schemas.finance.expense_category import ExpenseCategory, ExpenseCategoryCreate, ExpenseCategoryUpdate
from src.schemas.finance.expenditure import Expenditure, ExpenditureCreate, ExpenditureUpdate
from src.db.crud.finance import expense_category, expenditure

router = APIRouter()

@router.get("/summary")
def get_expenditure_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    tenant_id: UUID = Depends(get_tenant_id_from_request)
) -> Any:
    """Get expenditure summary."""
    return finance_service.get_expenditure_summary(db=db, tenant_id=tenant_id)

@router.get("/categories", response_model=List[ExpenseCategory])
def read_expense_categories(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    tenant_id: UUID = Depends(get_tenant_id_from_request)
) -> Any:
    """Retrieve expense categories."""
    return expense_category.get_multi(db, tenant_id=tenant_id, skip=skip, limit=limit)

@router.post("/categories", response_model=ExpenseCategory)
def create_expense_category(
    *,
    db: Session = Depends(get_db),
    category_in: ExpenseCategoryCreate,
    current_user: User = Depends(get_current_active_user),
    tenant_id: UUID = Depends(get_tenant_id_from_request)
) -> Any:
    """Create new expense category."""
    return expense_category.create(db=db, obj_in=category_in, tenant_id=tenant_id)

@router.put("/categories/{category_id}", response_model=ExpenseCategory)
def update_expense_category(
    *,
    db: Session = Depends(get_db),
    category_id: UUID,
    category_in: ExpenseCategoryUpdate,
    current_user: User = Depends(get_current_active_user),
    tenant_id: UUID = Depends(get_tenant_id_from_request)
) -> Any:
    """Update an expense category."""
    db_obj = expense_category.get_by_id(db, tenant_id=tenant_id, id=category_id)
    if not db_obj:
        raise HTTPException(status_code=404, detail="Expense category not found")
    return expense_category.update(db=db, tenant_id=tenant_id, db_obj=db_obj, obj_in=category_in)

@router.delete("/categories/{category_id}", response_model=ExpenseCategory)
def delete_expense_category(
    *,
    db: Session = Depends(get_db),
    category_id: UUID,
    current_user: User = Depends(get_current_active_user),
    tenant_id: UUID = Depends(get_tenant_id_from_request)
) -> Any:
    """Delete an expense category."""
    db_obj = expense_category.delete(db, tenant_id=tenant_id, id=category_id)
    if not db_obj:
        raise HTTPException(status_code=404, detail="Expense category not found")
    return db_obj

@router.get("", response_model=List[Expenditure])
def read_expenditures(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    tenant_id: UUID = Depends(get_tenant_id_from_request)
) -> Any:
    """Retrieve all expenditures."""
    return expenditure.get_multi(db, tenant_id=tenant_id, skip=skip, limit=limit)

@router.post("", response_model=Expenditure)
def create_expenditure(
    *,
    db: Session = Depends(get_db),
    expenditure_in: ExpenditureCreate,
    current_user: User = Depends(get_current_active_user),
    tenant_id: UUID = Depends(get_tenant_id_from_request)
) -> Any:
    """Record an expenditure."""
    return expenditure.create(db=db, obj_in=expenditure_in, tenant_id=tenant_id)

@router.put("/{expenditure_id}", response_model=Expenditure)
def update_expenditure(
    *,
    db: Session = Depends(get_db),
    expenditure_id: UUID,
    expenditure_in: ExpenditureUpdate,
    current_user: User = Depends(get_current_active_user),
    tenant_id: UUID = Depends(get_tenant_id_from_request)
) -> Any:
    """Update an expenditure."""
    db_obj = expenditure.get_by_id(db, tenant_id=tenant_id, id=expenditure_id)
    if not db_obj:
        raise HTTPException(status_code=404, detail="Expenditure not found")
    return expenditure.update(db=db, tenant_id=tenant_id, db_obj=db_obj, obj_in=expenditure_in)

@router.delete("/{expenditure_id}", response_model=Expenditure)
def delete_expenditure(
    *,
    db: Session = Depends(get_db),
    expenditure_id: UUID,
    current_user: User = Depends(get_current_active_user),
    tenant_id: UUID = Depends(get_tenant_id_from_request)
) -> Any:
    """Delete an expenditure."""
    db_obj = expenditure.delete(db, tenant_id=tenant_id, id=expenditure_id)
    if not db_obj:
        raise HTTPException(status_code=404, detail="Expenditure not found")
    return db_obj
