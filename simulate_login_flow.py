from fastapi.testclient import TestClient
import sys
import os

# Add Backend/sms-backend/src to path
sys.path.append(os.path.join(os.getcwd(), "Backend", "sms-backend"))

# Mock some things if needed or just use the app
from src.main import app
from src.db.session import SessionLocal
from src.core.security.password import get_password_hash
from sqlalchemy import text

client = TestClient(app)

def test_login_flow():
    email = "paul@topfoundation.com"
    password = "Password123!"
    tenant_id = "34624041-c24a-4400-a9b7-f692c3f3fba7"
    
    print(f"--- Simulating login for {email} with tenant {tenant_id} ---")
    
    # Ensure the user exists and has the correct password
    db = SessionLocal()
    try:
        hashed = get_password_hash(password)
        db.execute(
            text("UPDATE users SET password_hash = :hash, is_active = true WHERE email = :email"),
            {"hash": hashed, "email": email}
        )
        db.commit()
    finally:
        db.close()

    # Call the actual login endpoint
    response = client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": password},
        headers={"X-Tenant-ID": tenant_id}
    )
    
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
    
    if response.status_code == 401:
        print("LOGIN FAILED (401)")
    elif response.status_code == 200:
        print("LOGIN SUCCESSFUL!")
    else:
        print(f"UNEXPECTED STATUS: {response.status_code}")

if __name__ == "__main__":
    test_login_flow()
