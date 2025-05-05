import pytest
from uuid import uuid4
from src.db.models.tenant import Tenant, TenantSettings

def test_tenant_creation(db_session, tenant_data):
    """Test creating a new tenant."""
    tenant = Tenant(**tenant_data)
    db_session.add(tenant)
    db_session.commit()
    
    assert tenant.name == tenant_data["name"]
    assert tenant.code == tenant_data["code"]
    assert tenant.is_active == tenant_data["is_active"]
    assert tenant.settings is None

def test_tenant_code_uppercase(db_session):
    """Test that tenant code is automatically converted to uppercase."""
    tenant = Tenant(name="Test School", code="test")
    db_session.add(tenant)
    db_session.commit()
    
    assert tenant.code == "TEST"

def test_tenant_name_validation(db_session):
    """Test tenant name validation."""
    with pytest.raises(ValueError, match="tenant name must be at least 3 characters long"):
        Tenant(name="A", code="TEST")

def test_tenant_code_validation(db_session):
    """Test tenant code validation."""
    with pytest.raises(ValueError, match="tenant code must be at least 2 characters long"):
        Tenant(name="Test School", code="T")
    
    with pytest.raises(ValueError, match="tenant code can only contain alphanumeric characters"):
        Tenant(name="Test School", code="TEST!")

def test_tenant_required_fields(db_session):
    """Test that required fields are enforced."""
    with pytest.raises(ValueError, match="name is required for tenant"):
        Tenant(code="TEST")
    
    with pytest.raises(ValueError, match="code is required for tenant"):
        Tenant(name="Test School")

def test_tenant_relationship(db_session, tenant, tenant_settings):
    """Test the relationship between Tenant and TenantSettings."""
    assert tenant.settings == tenant_settings
    assert tenant_settings.tenant == tenant

def test_tenant_cascade_delete(db_session, tenant, tenant_settings):
    """Test that tenant settings are deleted when tenant is deleted."""
    settings_id = tenant_settings.id
    db_session.delete(tenant)
    db_session.commit()
    
    # Verify settings are deleted
    settings = db_session.query(TenantSettings).filter_by(id=settings_id).first()
    assert settings is None 