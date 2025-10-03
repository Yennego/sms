import sys
import os

# Add the src directory to Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from sqlalchemy.orm import Session
from src.db.session import get_super_admin_db
from src.db.models.tenant.tenant import Tenant
from sqlalchemy import select, update

def check_and_fix_tenant():
    """Check current tenant status and fix domain for localhost development"""
    
    # Use get_super_admin_db to get a session that can access all tenant data
    db_generator = get_super_admin_db()
    session = next(db_generator)
    
    try:
        tenant_id = "34624041-c24a-4400-a9b7-f692c3f3fba7"
        
        # Get the current tenant
        result = session.execute(
            select(Tenant).where(Tenant.id == tenant_id)
        )
        tenant = result.scalar_one_or_none()
        
        if not tenant:
            print(f"❌ Tenant with ID {tenant_id} not found!")
            return
        
        print("=== CURRENT TENANT STATUS ===")
        print(f"ID: {tenant.id}")
        print(f"Name: {tenant.name}")
        print(f"Code: {tenant.code}")
        print(f"Domain: {tenant.domain}")
        print(f"Subdomain: {tenant.subdomain}")
        print(f"Is Active: {tenant.is_active}")
        
        # Check if domain needs updating
        if tenant.domain != "localhost":
            print(f"\n🔧 FIXING DOMAIN: {tenant.domain} → localhost")
            
            # Update the tenant domain to localhost for development
            session.execute(
                update(Tenant)
                .where(Tenant.id == tenant_id)
                .values(
                    domain="localhost",
                    subdomain="topfoundation"
                )
            )
            
            session.commit()
            print("✅ Successfully updated tenant domain to localhost")
        else:
            print("\n✅ Domain is already set to localhost")
        
        # Verify the update
        result = session.execute(
            select(Tenant).where(Tenant.id == tenant_id)
        )
        updated_tenant = result.scalar_one_or_none()
        
        print("\n=== UPDATED TENANT STATUS ===")
        print(f"Domain: {updated_tenant.domain}")
        print(f"Subdomain: {updated_tenant.subdomain}")
        print(f"Is Active: {updated_tenant.is_active}")
        
        if updated_tenant.is_active and updated_tenant.domain == "localhost":
            print("\n🎉 TENANT IS NOW READY FOR LOCALHOST DEVELOPMENT!")
            print("\nNext steps:")
            print("1. Restart your backend server")
            print("2. Clear browser cookies/localStorage")
            print("3. Try accessing: http://localhost:3000/top-foundation.com/login")
        else:
            print("\n⚠️  Additional issues found:")
            if not updated_tenant.is_active:
                print("- Tenant is not active")
            if updated_tenant.domain != "localhost":
                print("- Domain update failed")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        session.rollback()
        raise
    finally:
        session.close()

if __name__ == "__main__":
    check_and_fix_tenant()