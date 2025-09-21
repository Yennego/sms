import sys
import os

# Add the src directory to Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from sqlalchemy.orm import Session
from src.db.session import get_super_admin_db
from src.db.models.tenant.tenant import Tenant
from sqlalchemy import select, update

def update_tenant_domain():
    """Update Top Foundation tenant to use top-foundation.com domain"""
    
    # Use get_super_admin_db to get a session that can access all tenant data
    db_generator = get_super_admin_db()
    session = next(db_generator)
    
    try:
        # Find the Top Foundation tenant
        tenant_id = "34624041-c24a-4400-a9b7-f692c3f3fba7"
        
        # Get the current tenant
        result = session.execute(
            select(Tenant).where(Tenant.id == tenant_id)
        )
        tenant = result.scalar_one_or_none()
        
        if not tenant:
            print(f"Tenant with ID {tenant_id} not found!")
            return
        
        print(f"Found tenant: {tenant.name}")
        print(f"Current domain: {tenant.domain}")
        print(f"Current subdomain: {tenant.subdomain}")
        
        # Update the tenant domain to top-foundation.com for production
        session.execute(
            update(Tenant)
            .where(Tenant.id == tenant_id)
            .values(
                domain="top-foundation.com",
                subdomain="topfoundation"
            )
        )
        
        session.commit()
        print("\n✅ Successfully updated Top Foundation tenant:")
        print("   - Domain: top-foundation.com")
        print("   - Subdomain: topfoundation")
        print("\nThe application should now work correctly with top-foundation.com!")
        
    except Exception as e:
        print(f"❌ Error updating tenant: {e}")
        session.rollback()
    finally:
        session.close()

if __name__ == "__main__":
    update_tenant_domain()