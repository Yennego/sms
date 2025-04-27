from typing import Any, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from src.db.models.tenant import Tenant
from src.schemas.tenant import TenantCreate, TenantUpdate

class TenantService:
    def get(self, db: Session, id: UUID) -> Optional[Tenant]:
        return db.query(Tenant).filter(Tenant.id == id).first()

    def get_by_slug(self, db: Session, slug: str) -> Optional[Tenant]:
        return db.query(Tenant).filter(Tenant.slug == slug).first()

    def get_by_domain(self, db: Session, domain: str) -> Optional[Tenant]:
        return db.query(Tenant).filter(Tenant.domain == domain).first()

    def get_multi(
        self, db: Session, *, skip: int = 0, limit: int = 100
    ) -> list[Tenant]:
        return db.query(Tenant).offset(skip).limit(limit).all()

    def create(self, db: Session, *, obj_in: TenantCreate) -> Tenant:
        db_obj = Tenant(
            name=obj_in.name,
            slug=obj_in.slug,
            domain=obj_in.domain,
            is_active=obj_in.is_active,
            settings=obj_in.settings,
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(
        self, db: Session, *, db_obj: Tenant, obj_in: TenantUpdate
    ) -> Tenant:
        update_data = obj_in.model_dump(exclude_unset=True)
        for field in update_data:
            setattr(db_obj, field, update_data[field])
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def remove(self, db: Session, *, id: UUID) -> Tenant:
        obj = db.query(Tenant).get(id)
        db.delete(obj)
        db.commit()
        return obj

tenant_service = TenantService() 