import sys
import os

# Add the parent directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from src.db.session import engine

def find_tenant_id():
    with engine.connect() as connection:
        result = connection.execute(text("SELECT tenant_id FROM users WHERE email='superadmin@example.com'"))
        tenant_id = result.fetchone()
        if tenant_id:
            print(f"Tenant ID for superadmin@example.com: {tenant_id[0]}")
        else:
            print("User not found")

if __name__ == "__main__":
    find_tenant_id()