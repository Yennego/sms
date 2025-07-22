import sys
import os

# Add the parent directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from src.db.session import engine

def check_tenant():
    tenant_id = "34624041-c24a-4400-a9b7-f692c3f3fba7"
    
    with engine.connect() as connection:
        # Check if tenant exists
        result = connection.execute(
            text("SELECT id, name, code, is_active, domain FROM tenants WHERE id = :tenant_id"),
            {"tenant_id": tenant_id}
        )
        tenant = result.fetchone()
        
        if tenant:
            print(f"Tenant found:")
            print(f"  ID: {tenant[0]}")
            print(f"  Name: {tenant[1]}")
            print(f"  Code: {tenant[2]}")
            print(f"  Is Active: {tenant[3]}")
            print(f"  Domain: {tenant[4]}")
            
            if not tenant[3]:  # is_active is False
                print("\n❌ ISSUE: Tenant exists but is INACTIVE!")
                print("Solution: Activate the tenant in the database")
            else:
                print("\n✅ Tenant is active - there might be another issue")
        else:
            print(f"❌ Tenant with ID {tenant_id} NOT FOUND in database!")
            print("\nSolution: Either:")
            print("1. Create this tenant in the database")
            print("2. Use a different tenant ID that exists")
            print("3. Check if the JWT token has the correct tenant_id")
        
        # List all active tenants
        print("\n--- All Active Tenants ---")
        result = connection.execute(text("SELECT id, name, code FROM tenants WHERE is_active = true"))
        tenants = result.fetchall()
        
        if tenants:
            for tenant in tenants:
                print(f"  {tenant[0]} - {tenant[1]} ({tenant[2]})")
        else:
            print("  No active tenants found!")

if __name__ == "__main__":
    check_tenant()