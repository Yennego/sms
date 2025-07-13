from src.db.session import SessionLocal
from src.db.models.logging.activity_log import ActivityLog
from src.services.logging import SuperAdminAuditLoggingService

def debug_audit_logs():
    db = SessionLocal()
    try:
        # Check total count
        total_logs = db.query(ActivityLog).count()
        print(f"Total audit logs in database: {total_logs}")
        
        # Get recent logs
        recent_logs = db.query(ActivityLog).order_by(ActivityLog.created_at.desc()).limit(5).all()
        print(f"Recent logs: {len(recent_logs)}")
        
        for log in recent_logs:
            print(f"- {log.created_at}: {log.action} on {log.entity_type} by user {log.user_id}")
        
        # Test service
        service = SuperAdminAuditLoggingService(db=db)
        all_logs = service.get_all_activity_logs(limit=10)
        print(f"Service returned: {len(all_logs)} logs")
        
    finally:
        db.close()

if __name__ == "__main__":
    debug_audit_logs()