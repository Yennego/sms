import sys
import os

# Add the src directory to Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from sqlalchemy.orm import Session
from src.db.session import get_super_admin_db
from src.db.models.tenant.tenant import Tenant
from sqlalchemy import select, update

def revert_tenant_domain():
    """Revert Top Foundation tenant domain back to top-foundation.com"""
    
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
        
        # Revert the tenant domain back to top-foundation.com
        print(f"\n🔧 REVERTING DOMAIN: {tenant.domain} → top-foundation.com")
        
        session.execute(
            update(Tenant)
            .where(Tenant.id == tenant_id)
            .values(
                domain="top-foundation.com",
                subdomain="topfoundation"
            )
        )
        
        session.commit()
        print("✅ Successfully reverted tenant domain to top-foundation.com")
        
        # Verify the revert
        result = session.execute(
            select(Tenant).where(Tenant.id == tenant_id)
        )
        updated_tenant = result.scalar_one_or_none()
        
        print("\n=== REVERTED TENANT STATUS ===")
        print(f"Domain: {updated_tenant.domain}")
        print(f"Subdomain: {updated_tenant.subdomain}")
        print(f"Is Active: {updated_tenant.is_active}")
        
        print("\n🎉 TENANT DOMAIN REVERTED SUCCESSFULLY!")
        print("\nThe domain is now back to: top-foundation.com")
        print("This matches the other tenants' domain pattern.")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        session.rollback()
        raise
    finally:
        session.close()

if __name__ == "__main__":
    revert_tenant_domain()