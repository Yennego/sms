import sys
sys.path.append('src')

from src.core.middleware.tenant import tenant_middleware
from fastapi import Request
from fastapi.testclient import TestClient
# from src.main import app

# Test the path filtering logic without importing the app
test_paths = [
    "/api/v1/tenants/dashboard/stats",
    "/api/v1/tenants/34624041-c24a-4400-a9b7-f692c3f3fba7",
    "/api/v1/auth/login"
]

for test_path in test_paths:
    print(f"\n=== Testing path: {test_path} ===")
    print(f"Starts with /api/: {test_path.startswith('/api/')}")
    print(f"Starts with /api/v1/tenants/: {test_path.startswith('/api/v1/tenants/')}")
    print(f"Starts with /api/v1/tenants/dashboard/: {test_path.startswith('/api/v1/tenants/dashboard/')}")
    print(f"Starts with /api/tenant/: {test_path.startswith('/api/tenant/')}")
    print(f"Starts with /api/v1/auth/: {test_path.startswith('/api/v1/auth/')}")
    
    # Check the middleware condition from tenant.py
    skip_condition = (not test_path.startswith("/api/") or 
                     (test_path.startswith("/api/v1/tenants/") and not test_path.startswith("/api/v1/tenants/dashboard/")) or
                     test_path.startswith("/api/tenant/") or
                     test_path.startswith("/api/v1/auth/"))
    
    print(f"Should skip middleware: {skip_condition}")
    print(f"Should process with tenant middleware: {not skip_condition}")