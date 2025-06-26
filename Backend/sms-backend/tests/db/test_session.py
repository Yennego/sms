import pytest
from uuid import uuid4
from src.db.session import session_manager, tenant_id_ctx
from src.db.models.tenant import Tenant, TenantSettings
from src.db.models.base import Base

@pytest.fixture(scope="session", autouse=True)
def setup_database():
    """Create database tables before running tests."""
    session_manager.create_database()
    yield
    # Clean up after all tests
    Base.metadata.drop_all(bind=session_manager.engine)

@pytest.fixture(autouse=True)
def cleanup_tenant_context():
    """Clean up tenant context after each test."""
    yield
    tenant_id_ctx.set(None)

def test_session_tenant_isolation():
    """Test that sessions properly isolate tenant data."""
    # Create two tenants
    tenant1_id = str(uuid4())
    tenant2_id = str(uuid4())
    
    # Create session for tenant 1
    session_manager.set_tenant(tenant1_id)
    db1 = next(session_manager.get_db())
    
    # Create tenant 1 data
    tenant1 = Tenant(
        id=tenant1_id,
        name="Test Tenant 1",
        code="TENANT1"
    )
    db1.add(tenant1)
    db1.commit()
    
    # Verify tenant 1 session has correct context
    assert db1.info.get('tenant_id') == tenant1_id
    
    # Create session for tenant 2
    session_manager.set_tenant(tenant2_id)
    db2 = next(session_manager.get_db())
    
    # Create tenant 2 data
    tenant2 = Tenant(
        id=tenant2_id,
        name="Test Tenant 2",
        code="TENANT2"
    )
    db2.add(tenant2)
    db2.commit()
    
    # Verify tenant 2 session has correct context
    assert db2.info.get('tenant_id') == tenant2_id
    
    # Verify tenant 1 can only see their data
    session_manager.set_tenant(tenant1_id)
    db1 = next(session_manager.get_db())
    tenants = db1.query(Tenant).filter(Tenant.id == tenant1_id).all()
    assert len(tenants) == 1
    assert tenants[0].id == tenant1_id
    
    # Verify tenant 2 can only see their data
    session_manager.set_tenant(tenant2_id)
    db2 = next(session_manager.get_db())
    tenants = db2.query(Tenant).filter(Tenant.id == tenant2_id).all()
    assert len(tenants) == 1
    assert tenants[0].id == tenant2_id
    
    # Cleanup
    db1.delete(tenant1)
    db2.delete(tenant2)
    db1.commit()
    db2.commit()

def test_session_tenant_context():
    """Test tenant context management."""
    # Set tenant ID
    test_tenant_id = str(uuid4())
    session_manager.set_tenant(test_tenant_id)
    
    # Verify tenant ID is set in context
    assert tenant_id_ctx.get() == test_tenant_id
    
    # Get session and verify tenant context
    db = next(session_manager.get_db())
    assert db.info.get('tenant_id') == test_tenant_id
    
    # Clear tenant context
    tenant_id_ctx.set(None)
    assert tenant_id_ctx.get() is None

def test_session_connection_pool():
    """Test connection pool configuration."""
    # Get multiple sessions
    sessions = []
    for _ in range(3):
        db = next(session_manager.get_db())
        sessions.append(db)
    
    # Verify sessions are different but share the same engine
    assert len(set(id(session) for session in sessions)) == 3
    assert all(session.bind is session_manager.engine for session in sessions)
    
    # Cleanup
    for session in sessions:
        session.close() 