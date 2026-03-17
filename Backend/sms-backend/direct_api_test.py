import requests
from src.db.session import SessionLocal
from src.db.models.auth import User
from src.core.security.jwt import create_access_token

db = SessionLocal()
jarboi = db.query(User).filter(User.email=="jarboi@mail.com").first()

token = create_access_token(
    subject=jarboi.id,
    tenant_id=jarboi.tenant_id,
    is_super_admin=False
)

headers = {
    "Authorization": f"Bearer {token}",
    "X-Tenant-ID": str(jarboi.tenant_id)
}

# Testing GET /settings which previously 404ed
resp = requests.get(f"http://localhost:8000/api/v1/tenants/{jarboi.tenant_id}/settings", headers=headers)
print("Status:", resp.status_code)
try:
    print("Response:", resp.json())
except:
    print("Text:", resp.text[:1000])
