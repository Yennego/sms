from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from src.schemas.parent import Parent, ParentCreate, ParentUpdate
from src.db.session import get_db
from src.db.crud.parent import ParentCRUD
from src.core.middleware.tenant import get_tenant_id_from_request

router = APIRouter()
crud = ParentCRUD

@router.get("/", response_model=List[Parent])
def list_parents(db: Session = Depends(get_db), tenant_id: str = Depends(get_tenant_id_from_request)):
    return crud.list(db, tenant_id=tenant_id)

@router.get("/{parent_id}", response_model=Parent)
def get_parent(parent_id: str, db: Session = Depends(get_db), tenant_id: str = Depends(get_tenant_id_from_request)):
    parent = crud.get_by_id(db, parent_id, tenant_id=tenant_id)
    if not parent:
        raise HTTPException(status_code=404, detail="Parent not found")
    return parent

@router.post("/", response_model=Parent)
def create_parent(parent_in: ParentCreate, db: Session = Depends(get_db), tenant_id: str = Depends(get_tenant_id_from_request)):
    return crud.create(db, obj_in=parent_in, tenant_id=tenant_id)

@router.post("/bulk", response_model=List[Parent])
def bulk_create_parents(parents_in: List[ParentCreate], db: Session = Depends(get_db), tenant_id: str = Depends(get_tenant_id_from_request)):
    return crud.bulk_create(db, parents_in, tenant_id=tenant_id)

@router.put("/{parent_id}", response_model=Parent)
def update_parent(parent_id: str, parent_in: ParentUpdate, db: Session = Depends(get_db), tenant_id: str = Depends(get_tenant_id_from_request)):
    return crud.update(db, parent_id, obj_in=parent_in, tenant_id=tenant_id)

@router.delete("/{parent_id}")
def delete_parent(parent_id: str, db: Session = Depends(get_db), tenant_id: str = Depends(get_tenant_id_from_request)):
    crud.delete(db, parent_id, tenant_id=tenant_id)
    return {"ok": True} 