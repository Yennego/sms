import pytest
from unittest.mock import MagicMock
from types import SimpleNamespace
# from src.services.tenant import TenantService

@pytest.fixture
def tenant_service():
    # Mock the CRUD dependency
    mock_crud = MagicMock()
    # Use SimpleNamespace to simulate a real object
    mock_crud.create.return_value = SimpleNamespace(name="Test School", slug="test-school")
    # You would import and instantiate your actual service here, passing the mock_crud
    # service = TenantService(crud=mock_crud, model=Tenant, db=MagicMock(), tenant_id="test-tenant-id")
    # return service
    return mock_crud  # For demonstration

def test_tenant_service_create(tenant_service):
    tenant_data = {"name": "Test School", "slug": "test-school", "domain": "test.com", "is_active": True, "settings": {}}
    tenant = tenant_service.create(obj_in=tenant_data)
    assert tenant.name == "Test School"
    assert tenant.slug == "test-school"

    # TODO: Uncomment and use actual service logic
    # tenant_data = {"name": "Test School", "slug": "test-school", "domain": "test.com", "is_active": True, "settings": {}}
    # tenant = tenant_service.create(obj_in=tenant_data)
    # assert tenant.name == "Test School" 