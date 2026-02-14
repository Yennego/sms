import sys
import os
from fastapi.testclient import TestClient

# Add the current directory (Backend/sms-backend) to path
current_dir = os.getcwd()
if current_dir not in sys.path:
    sys.path.append(current_dir)

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
        # Check if user exists
        user = db.execute(text("SELECT id FROM users WHERE email = :email"), {"email": email}).first()
        if not user:
            print(f"ERROR: User {email} does not exist in DB!")
            return

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
    try:
        print(f"Response: {response.json()}")
    except:
        print(f"Raw Response: {response.text}")
    
    if response.status_code == 401:
        print("LOGIN FAILED (401)")
    elif response.status_code == 200:
        print("LOGIN SUCCESSFUL!")
    else:
        print(f"UNEXPECTED STATUS: {response.status_code}")

if __name__ == "__main__":
    test_login_flow()
