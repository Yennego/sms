from datetime import datetime, timedelta
import random
from uuid import uuid4
from sqlalchemy.orm import Session
from src.db.session import SessionLocal
from src.db.models.logging.activity_log import ActivityLog
from src.db.models.auth.user import User
from src.db.models.tenant.tenant import Tenant

def populate_sample_audit_logs():
    """Populate the database with sample audit logs for testing."""
    db = SessionLocal()
    try:
        # Get existing users and tenants
        users = db.query(User).all()
        tenants = db.query(Tenant).all()
        
        if not users or not tenants:
            print("No users or tenants found. Please create some users and tenants first.")
            return
        
        # Sample actions and entity types
        actions = ['login', 'logout', 'create', 'update', 'delete', 'view', 'export']
        entity_types = ['user', 'student', 'teacher', 'grade', 'course', 'assignment', 'tenant']
        
        # Create sample audit logs for the last 30 days
        sample_logs = []
        for i in range(50):  # Create 50 sample logs
            user = random.choice(users)
            tenant = random.choice(tenants)
            action = random.choice(actions)
            entity_type = random.choice(entity_types)
            
            # Random timestamp within last 30 days
            days_ago = random.randint(0, 30)
            hours_ago = random.randint(0, 23)
            minutes_ago = random.randint(0, 59)
            
            created_at = datetime.now() - timedelta(days=days_ago, hours=hours_ago, minutes=minutes_ago)
            
            # Sample data based on action
            old_values = None
            new_values = None
            
            if action == 'create':
                new_values = {"name": f"Sample {entity_type}", "status": "active"}
            elif action == 'update':
                old_values = {"name": f"Old {entity_type}", "status": "inactive"}
                new_values = {"name": f"Updated {entity_type}", "status": "active"}
            elif action == 'delete':
                old_values = {"name": f"Deleted {entity_type}", "status": "active"}
            
            audit_log = ActivityLog(
                tenant_id=tenant.id,  # Explicitly pass tenant_id
                user_id=user.id,
                action=action,
                entity_type=entity_type,
                entity_id=uuid4(),
                old_values=old_values,
                new_values=new_values,
                ip_address=f"192.168.1.{random.randint(1, 254)}",
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                created_at=created_at,
                updated_at=created_at
            )
            sample_logs.append(audit_log)
        
        # Add all logs to database
        db.add_all(sample_logs)
        db.commit()
        
        print(f"Successfully created {len(sample_logs)} sample audit logs")
        
    except Exception as e:
        print(f"Error creating sample audit logs: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    populate_sample_audit_logs()