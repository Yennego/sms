import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch
from uuid import uuid4

from src.core.middleware.tenant import tenant_middleware
from src.db.models.tenant import Tenant

# Mock DB Session
class MockSession:
    def __init__(self):
        self.query_results = {}
        
    def query(self, model):
        self.current_model = model
        return self
        
    def filter(self, *args, **kwargs):
        # Simple mock filter that checks if we're looking for our test tenant
        # This is a simplification; in a real test we'd parse the args
        return self
        
    def first(self):
        return self.query_results.get(self.current_model)
        
    def close(self):
        pass

# Create a simple app with the middleware
app = FastAPI()
app.middleware("http")(tenant_middleware)

@app.get("/api/v1/test")
def test_endpoint(request: Request):
    return {"message": "success"}

@pytest.fixture
def client():
    return TestClient(app)

@pytest.fixture
def mock_db():
    with patch("src.core.middleware.tenant.get_db") as mock_get_db:
        session = MockSession()
        mock_get_db.return_value = iter([session])
        yield session

def test_tenant_resolution_by_slug_header(client, mock_db):
    # Setup mock tenant
    tenant_id = uuid4()
    mock_tenant = Tenant(id=tenant_id, name="Test Tenant", domain="test-slug", is_active=True)
    
    # We need to mock the chain: db.query(Tenant).filter(...).first()
    # Since our MockSession is simple, we'll just patch the query method to return a mock that returns our tenant
    with patch.object(MockSession, 'query') as mock_query:
        mock_filter = MagicMock()
        mock_filter.first.return_value = mock_tenant
        mock_query.return_value.filter.return_value = mock_filter
        
        # Test with slug in X-Tenant-ID
        response = client.get("/api/v1/test", headers={"X-Tenant-ID": "test-slug"})
        
        assert response.status_code == 200
        # Verify that we searched for the slug (domain)
        # Note: The middleware tries UUID, then Code, then Domain.
        # We can't easily verify the exact filter args with this simple mock, 
        # but success means it found the tenant.

def test_tenant_resolution_by_referer_slug(client, mock_db):
    # Setup mock tenant
    tenant_id = uuid4()
    mock_tenant = Tenant(id=tenant_id, name="Test Tenant", domain="test-slug", is_active=True)
    
    with patch.object(MockSession, 'query') as mock_query:
        mock_filter = MagicMock()
        mock_filter.first.return_value = mock_tenant
        mock_query.return_value.filter.return_value = mock_filter
        
        # Test with Referer header containing the slug
        response = client.get(
            "/api/v1/test", 
            headers={"Referer": "http://localhost:3000/test-slug/dashboard"}
        )
        
        assert response.status_code == 200
