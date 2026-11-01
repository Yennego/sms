"""One unit of work per request: changes are saved together, or not at all."""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import attendance_fixtures  # noqa: F401  registers models and the SQLite JSONB shim
from src.db.crud import tenant as tenant_crud
from src.db.models.base import Base
from src.db.models.tenant.tenant import Tenant
from src.db.session import request_session
from src.schemas.tenant.tenant import TenantCreate


@pytest.fixture
def Session():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    yield sessionmaker(bind=engine)
    engine.dispose()


def _count(Session):
    db = Session()
    try:
        return db.query(Tenant).count()
    finally:
        db.close()


def test_successful_request_commits_crud_changes(Session):
    gen = request_session(Session)
    db = next(gen)
    tenant_crud.create(db, obj_in=TenantCreate(name="School A", code="SCA", domain="school-a"))
    with pytest.raises(StopIteration):
        next(gen)  # the endpoint returned normally
    assert _count(Session) == 1


def test_failed_request_saves_nothing(Session):
    gen = request_session(Session)
    db = next(gen)
    tenant_crud.create(db, obj_in=TenantCreate(name="School A", code="SCA", domain="school-a"))
    tenant_crud.create(db, obj_in=TenantCreate(name="School B", code="SCB", domain="school-b"))
    with pytest.raises(ValueError):
        gen.throw(ValueError("a later step failed"))
    assert _count(Session) == 0
