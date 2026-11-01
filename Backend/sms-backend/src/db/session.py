import logging
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import Session, sessionmaker
from src.core.config import settings
import contextvars
from uuid import UUID
from typing import Optional
# Create a context variable to store tenant ID
tenant_id_var = contextvars.ContextVar('tenant_id', default=None)

def set_tenant_id(tenant_id: UUID) -> None:
    """Set the tenant ID for the current context."""
    tenant_id_var.set(tenant_id)

def get_tenant_id() -> Optional [UUID]:
    """Get the tenant ID for the current context."""
    return tenant_id_var.get()

# Add this function for super admin database access
def get_super_admin_db():
    """Get a database session for super admin operations.
    This session can access data across all tenants (row level security bypass)."""
    yield from request_session(platform_session)

logger = logging.getLogger(__name__)

# Log the database URL (with password masked)
db_url_parts = settings.DATABASE_URL.split('@')
if len(db_url_parts) > 1:
    masked_url = db_url_parts[0].split(':')[0] + ':***@' + db_url_parts[1]
    logger.info(f"Connecting to database: {masked_url}")

# Optimize engine with connection pooling
engine = create_engine(
    settings.DATABASE_URL,
    pool_size=50,
    max_overflow=100,
    pool_timeout=60,
    pool_pre_ping=True,
    pool_recycle=1800
)

# Add connection event listeners
@event.listens_for(engine, "connect")
def connect(dbapi_connection, connection_record):
    logger.info("Database connection established")

@event.listens_for(engine, "checkout")
def checkout(dbapi_connection, connection_record, connection_proxy):
    logger.debug("Database connection checked out")

@event.listens_for(engine, "checkin")
def checkin(dbapi_connection, connection_record):
    logger.debug("Database connection checked in")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# --- Row level security context ------------------------------------------------------------
# PostgreSQL policies on school tables (migration d3a6f9c2e5b7) only show rows whose tenant_id
# matches the transaction setting app.tenant_id, unless app.bypass_rls is 'on'. Each
# transaction gets both settings from the session (or the request's tenant context var).
# Superuser and BYPASSRLS connections ignore the policies; production connects as a role
# without either (see scripts/create_app_db_role.sql).

def _rls_settings(session: Session):
    if session.info.get("bypass_rls"):
        return "", "on"
    tenant_id = session.info.get("tenant_id") or get_tenant_id()
    return (str(tenant_id) if tenant_id else ""), "off"


@event.listens_for(Session, "after_begin")
def _apply_rls_on_begin(session, transaction, connection):
    if connection.dialect.name != "postgresql":
        return
    tenant_id, bypass = _rls_settings(session)
    connection.execute(
        text("SELECT set_config('app.tenant_id', :t, true), set_config('app.bypass_rls', :b, true)"),
        {"t": tenant_id, "b": bypass},
    )


def bind_session_to_tenant(session: Session, tenant_id=None, *, bypass: bool = False) -> None:
    """Scope a session to one school (or to all, for platform work), including the open transaction."""
    session.info["tenant_id"] = tenant_id
    session.info["bypass_rls"] = bypass
    if session.bind is not None and session.bind.dialect.name == "postgresql" and session.in_transaction():
        t, b = _rls_settings(session)
        session.execute(
            text("SELECT set_config('app.tenant_id', :t, true), set_config('app.bypass_rls', :b, true)"),
            {"t": t, "b": b},
        )


def platform_session() -> Session:
    """A session that sees every school: platform routes, background jobs, scripts."""
    db = SessionLocal()
    db.info["bypass_rls"] = True
    return db

def request_session(session_factory):
    """One unit of work per request.

    CRUD helpers only flush; the request's changes are committed together when the
    endpoint succeeds and rolled back when it raises (FastAPI runs this exit code before
    the response is sent, so a failed commit is reported as an error, not a success).
    """
    db = session_factory()
    try:
        yield db
        if db.in_transaction():
            db.commit()
    except BaseException:
        db.rollback()
        raise
    finally:
        db.close()


def get_db():
    yield from request_session(SessionLocal)
