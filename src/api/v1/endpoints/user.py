from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import List

from src.schemas.user import User, UserCreate, UserUpdate
from src.db.session import get_db
from src.db.crud.user import UserCRUD
from src.core.middleware.tenant import get_tenant_id_from_request

router = APIRouter()
crud = UserCRUD

@router.get("/", response_model=List[User])
def list_users(db: Session = Depends(get_db), tenant_id: str = Depends(get_tenant_id_from_request)):
    return crud.list(db, tenant_id=tenant_id)

@router.get("/{user_id}", response_model=User)
def get_user(user_id: str, db: Session = Depends(get_db), tenant_id: str = Depends(get_tenant_id_from_request)):
    user = crud.get_by_id(db, user_id, tenant_id=tenant_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.post("/", response_model=User)
def create_user(user_in: UserCreate, db: Session = Depends(get_db), tenant_id: str = Depends(get_tenant_id_from_request)):
    return crud.create(db, obj_in=user_in, tenant_id=tenant_id)

@router.put("/{user_id}", response_model=User)
def update_user(user_id: str, user_in: UserUpdate, db: Session = Depends(get_db), tenant_id: str = Depends(get_tenant_id_from_request)):
    return crud.update(db, user_id, obj_in=user_in, tenant_id=tenant_id)

@router.delete("/{user_id}")
def delete_user(user_id: str, db: Session = Depends(get_db), tenant_id: str = Depends(get_tenant_id_from_request)):
    crud.delete(db, user_id, tenant_id=tenant_id)
    return {"ok": True}

@router.post("/bulk", response_model=List[User])
def bulk_create_users(
    users_in: List[UserCreate] = Body(...),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id_from_request)
):
    return crud.bulk_create(db, users_in, tenant_id=tenant_id)

@router.delete("/bulk")
def bulk_delete_users(
    ids: List[str] = Body(...),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id_from_request)
):
    count = crud.bulk_delete(db, ids, tenant_id=tenant_id)
    return {"deleted": count} 