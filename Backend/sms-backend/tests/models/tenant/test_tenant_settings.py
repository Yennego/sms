import pytest
from uuid import uuid4
from src.db.models.tenant.tenant import Tenant
from src.db.models.tenant.tenant_settings import TenantSettings

def test_tenant_settings_creation(db_session, tenant, tenant_settings_data):
    """Test creating new tenant settings."""
    settings = TenantSettings(tenant_id=tenant.id, **tenant_settings_data)
    db_session.add(settings)
    db_session.commit()
    
    assert settings.theme == tenant_settings_data["theme"]
    assert settings.is_active == tenant_settings_data["is_active"]
    assert settings.tenant == tenant

def test_tenant_settings_default_values(db_session, tenant):
    """Test that default values are set correctly."""
    settings = TenantSettings(tenant_id=tenant.id)
    db_session.add(settings)
    db_session.commit()
    
    assert settings.settings["academic_year"]["start_month"] == 9
    assert settings.settings["academic_year"]["end_month"] == 6
    assert settings.settings["features"]["enable_parent_portal"] is True
    assert settings.settings["system"]["timezone"] == "UTC"

def test_tenant_settings_theme_validation(db_session, tenant):
    """Test theme validation."""
    with pytest.raises(ValueError, match="theme must be one of"):
        TenantSettings(tenant_id=tenant.id, theme="invalid")

def test_tenant_settings_required_fields(db_session):
    """Test that required fields are enforced."""
    with pytest.raises(ValueError, match="tenant_id is required for tenant settings"):
        TenantSettings()

def test_tenant_settings_update_method(db_session, tenant_settings):
    """Test the update_setting method."""
    # Test valid update
    tenant_settings.update_setting("features", "enable_sms_notifications", True)
    assert tenant_settings.settings["features"]["enable_sms_notifications"] is True
    
    # Test invalid section
    with pytest.raises(ValueError, match="Invalid settings section"):
        tenant_settings.update_setting("invalid_section", "key", "value")
    
    # Test invalid key
    with pytest.raises(ValueError, match="Invalid setting key"):
        tenant_settings.update_setting("features", "invalid_key", "value")

def test_tenant_settings_relationship(db_session, tenant, tenant_settings):
    """Test the relationship between TenantSettings and Tenant."""
    assert tenant_settings.tenant == tenant
    assert tenant.settings == tenant_settings 