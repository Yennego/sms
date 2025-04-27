from contextvars import ContextVar
from typing import Any, Dict, Optional, Union, Generator
from uuid import UUID

from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import QueuePool

from src.core.config import settings

# Create SQLAlchemy engine
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    echo=True  # Enable SQL query logging
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create base class for models
Base = declarative_base()

# Context variable for tenant ID
tenant_id_var: ContextVar[str | None] = ContextVar("tenant_id", default=None)

def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_tenant_id() -> str | None:
    return tenant_id_var.get()

def set_tenant_id(tenant_id: str) -> None:
    tenant_id_var.set(tenant_id)


class TenantSessionLocal:
    """Session factory that automatically filters by tenant_id."""
    
    def __init__(self, tenant_id: Union[str, UUID]):
        self.tenant_id = str(tenant_id) if isinstance(tenant_id, UUID) else tenant_id
    
    def __call__(self):
        db = SessionLocal()
        set_tenant_id(self.tenant_id)
        return db


def get_tenant_db(tenant_id: Union[str, UUID]):
    """Get database session with tenant context."""
    tenant_session = TenantSessionLocal(tenant_id)
    db = tenant_session()
    try:
        yield db
    finally:
        db.close()


# Add event listeners to automatically filter queries by tenant_id
@event.listens_for(Session, "before_flush")
def before_flush(session, flush_context, instances):
    """Ensure all tenant models have the correct tenant_id."""
    tenant_id = get_tenant_id()
    if not tenant_id:
        return
    
    for obj in session.new:
        if hasattr(obj, "tenant_id") and obj.tenant_id is None:
            obj.tenant_id = tenant_id


# Add query filtering based on tenant context
@event.listens_for(Session, "do_orm_execute")
def do_orm_execute(execute_state):
    """Automatically filter queries by tenant_id."""
    tenant_id = get_tenant_id()
    if not tenant_id:
        return
    
    # Skip for internal SQLAlchemy queries
    if execute_state.is_select and not execute_state.is_column_load and not execute_state.is_relationship_load:
        # Check if the primary entity has tenant_id attribute
        if hasattr(execute_state.statement, "_primary_entity") and \
           hasattr(execute_state.statement._primary_entity.entity, "tenant_id"):
            # Add tenant_id filter to the query
            execute_state.statement = execute_state.statement.filter(
                execute_state.statement._primary_entity.entity.tenant_id == tenant_id
            )
        else:
            # For raw queries, use execution options
            execute_state.statement = execute_state.statement.execution_options(tenant_id=tenant_id)