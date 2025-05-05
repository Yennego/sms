import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from uuid import uuid4

from src.db.models.base import Base
from src.db.models.auth import User, UserRole, Permission, Admin
from src.db.models.base.tenant_model import TenantModel
from src.db.models.tenant.tenant import Tenant
from src.db.models.tenant.tenant_settings import TenantSettings
from src.db.models.tenant import Tenant, TenantSettings

# Create in-memory SQLite database for testing
TEST_DB_URL = "sqlite:///:memory:"

@pytest.fixture(scope="session")
def engine():
    """Create a test database engine."""
    engine = create_engine(TEST_DB_URL)
    # Create all tables
    from src.db.models.base import Base
    Base.metadata.create_all(engine)
    yield engine
    # Drop all tables
    Base.metadata.drop_all(engine)

@pytest.fixture
def db_session(engine):
    """Create a fresh database session for each test."""
    connection = engine.connect()
    transaction = connection.begin()
    session = sessionmaker(bind=connection)()
    
    yield session
    
    session.close()
    if transaction.is_active:
        transaction.rollback()
    connection.close()

@pytest.fixture
def tenant_data():
    """Sample tenant data for testing."""
    return {
        "name": "Test School",
        "code": "TSCH",
        "is_active": True
    }

@pytest.fixture
def tenant_settings_data():
    """Sample tenant settings data."""
    return {
        "theme": "light",
        "is_active": True
    }

@pytest.fixture
def tenant(db_session, tenant_data):
    """Create a test tenant."""
    tenant = Tenant(**tenant_data)
    db_session.add(tenant)
    db_session.commit()
    return tenant

@pytest.fixture
def tenant_settings(db_session, tenant):
    """Create test tenant settings."""
    settings = TenantSettings(tenant_id=tenant.id)
    db_session.add(settings)
    db_session.commit()
    return settings