import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from src.db.session import get_db
from src.db.models.tenant.tenant import Tenant
from src.db.models.tenant.tenant_settings import TenantSettings
from uuid import UUID
from datetime import datetime, timezone

def create_tenants_for_existing_users():
    """Create tenant records for existing user tenant IDs."""
    db = next(get_db())
    
    # Existing tenant IDs from your user data
    tenant_data = [
        {
            'id': '26d42af0-b296-4fd3-ad6d-413628798f92',
            'name': 'Primary School',
            'code': 'PRI',
            'domain': 'primary.school.com',
            'subdomain': 'primary',
            'primary_color': '#2E7D32',
            'secondary_color': '#4CAF50'
        },
        {
            'id': '3ebb1db5-6e94-4501-9bf8-84327683a021',
            'name': 'Secondary Academy',
            'code': 'SEC',
            'domain': 'secondary.academy.com',
            'subdomain': 'secondary',
            'primary_color': '#1976D2',
            'secondary_color': '#2196F3'
        },
        {
            'id': '6d78d2cc-27ba-4da7-a06f-6186aadbb476',
            'name': 'Admin Central',
            'code': 'ADM',
            'domain': 'admin.central.com',
            'subdomain': 'admin',
            'primary_color': '#7B1FA2',
            'secondary_color': '#9C27B0'
        }
    ]
    
    try:
        created_tenants = []
        
        for tenant_info in tenant_data:
            # Check if tenant already exists
            existing_tenant = db.query(Tenant).filter(Tenant.id == UUID(tenant_info['id'])).first()
            
            if existing_tenant:
                print(f"✅ Tenant {tenant_info['name']} already exists (ID: {tenant_info['id']})")
                created_tenants.append(existing_tenant)
                continue
            
            print(f"🏫 Creating tenant: {tenant_info['name']}...")
            
            # Create tenant with specific ID
            tenant = Tenant(
                id=UUID(tenant_info['id']),
                name=tenant_info['name'],
                code=tenant_info['code'],
                is_active=True,
                domain=tenant_info['domain'],
                subdomain=tenant_info['subdomain'],
                logo=None,
                primary_color=tenant_info['primary_color'],
                secondary_color=tenant_info['secondary_color'],
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc)
            )
            
            db.add(tenant)
            db.flush()
            
            # Create tenant settings
            print(f"⚙️ Creating settings for {tenant_info['name']}...")
            
            tenant_settings = TenantSettings(
                tenant_id=tenant.id,
                theme="light",
                settings={
                    "academic_year": {
                        "start_month": 9,
                        "end_month": 6,
                        "current_year": "2024-2025"
                    },
                    "features": {
                        "enable_parent_portal": True,
                        "enable_sms_notifications": True,
                        "enable_email_notifications": True,
                        "enable_attendance_tracking": True,
                        "enable_grade_management": True
                    },
                    "system": {
                        "timezone": "UTC",
                        "date_format": "YYYY-MM-DD",
                        "time_format": "24h",
                        "language": "en"
                    },
                    "branding": {
                        "school_motto": "Excellence in Education",
                        "contact_email": f"admin@{tenant_info['domain']}",
                        "contact_phone": "+1-555-0123",
                        "address": "123 Education Street, Learning City, LC 12345"
                    }
                },
                is_active=True,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc)
            )
            
            db.add(tenant_settings)
            created_tenants.append(tenant)
            
            print(f"✅ Created tenant: {tenant.name} (ID: {tenant.id})")
        
        db.commit()
        
        print("\n" + "="*60)
        print("🎉 TENANT CREATION COMPLETE!")
        print("="*60)
        
        for tenant in created_tenants:
            print(f"\n📋 Tenant: {tenant.name}")
            print(f"   - ID: {tenant.id}")
            print(f"   - Code: {tenant.code}")
            print(f"   - Domain: {tenant.domain}")
            print(f"   - Active: {tenant.is_active}")
        
        # Verify user-tenant relationships
        print("\n" + "="*60)
        print("🔍 VERIFYING USER-TENANT RELATIONSHIPS")
        print("="*60)
        
        from src.db.models.auth.user import User
        users = db.query(User).all()
        
        for user in users:
            tenant = db.query(Tenant).filter(Tenant.id == user.tenant_id).first()
            if tenant:
                print(f"✅ User {user.email} → Tenant {tenant.name} ({tenant.code})")
            else:
                print(f"❌ User {user.email} → Missing tenant (ID: {user.tenant_id})")
        
        return True
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error creating tenants: {e}")
        return False
    finally:
        db.close()

if __name__ == "__main__":
    print("🚀 Creating tenants for existing user data...\n")
    
    success = create_tenants_for_existing_users()
    
    if success:
        print("\n" + "="*60)
        print("🎉 SUCCESS! All tenants created successfully!")
        print("="*60)
        print("\nYour existing users are now properly linked to tenants.")
        print("You can now:")
        print("1. Start your backend server")
        print("2. Test tenant-specific endpoints")
        print("3. Access the frontend with tenant domains")
        print("4. All existing user data is preserved!")
    else:
        print("\n❌ Setup failed. Please check the error messages above.")