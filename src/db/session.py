import logging
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from src.core.config import settings
import contextvars
from uuid import UUID

# Create a context variable to store tenant ID
tenant_id_var = contextvars.ContextVar('tenant_id', default=None)

def set_tenant_id(tenant_id: UUID) -> None:
    """Set the tenant ID for the current context."""
    tenant_id_var.set(tenant_id)

def get_tenant_id() -> UUID:
    """Get the tenant ID for the current context."""
    return tenant_id_var.get()

# Add this function for super admin database access
def get_super_admin_db():
    """Get a database session for super admin operations.
    This session can access data across all tenants."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

logger = logging.getLogger(__name__)

# Log the database URL (with password masked)
db_url_parts = settings.DATABASE_URL.split('@')
if len(db_url_parts) > 1:
    masked_url = db_url_parts[0].split(':')[0] + ':***@' + db_url_parts[1]
    logger.info(f"Connecting to database: {masked_url}")

engine = create_engine(settings.DATABASE_URL)

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

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()