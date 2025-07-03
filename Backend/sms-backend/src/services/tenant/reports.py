from typing import Dict, Any, List, Optional
from uuid import UUID
from datetime import datetime, timedelta
from sqlalchemy import func

from src.db.models.auth import User
from src.db.models.tenant import Tenant
from src.db.crud import tenant as tenant_crud
from src.services.base.base import SuperAdminBaseService

class SystemReportsService(SuperAdminBaseService):
    """
    Service for generating system-wide reports for super-admin.
    """
    def generate_tenant_usage_report(self, tenant_id: Optional[UUID] = None, 
                                   start_date: Optional[datetime] = None,
                                   end_date: Optional[datetime] = None) -> Dict[str, Any]:
        """Generate tenant usage report."""
        # Set default date range if not provided
        if not end_date:
            end_date = datetime.utcnow()
        if not start_date:
            start_date = end_date - timedelta(days=30)  # Default to last 30 days
        
        # Query for user count per tenant
        query = self.db.query(
            User.tenant_id,
            func.count(User.id).label("user_count")
        ).group_by(User.tenant_id)
        
        if tenant_id:
            query = query.filter(User.tenant_id == tenant_id)
        
        results = query.all()
        
        # Format results
        tenant_usage = []
        for result in results:
            tenant = tenant_crud.get(self.db, id=result.tenant_id)
            tenant_usage.append({
                "tenant_id": result.tenant_id,
                "tenant_name": tenant.name if tenant else "Unknown",
                "user_count": result.user_count
            })
        
        return {
            "report_type": "tenant_usage",
            "data": tenant_usage,
            "period": {
                "start_date": start_date,
                "end_date": end_date
            }
        }
    
    def generate_user_activity_report(self, tenant_id: Optional[UUID] = None,
                                    start_date: Optional[datetime] = None,
                                    end_date: Optional[datetime] = None) -> Dict[str, Any]:
        """Generate user activity report."""
        # Set default date range if not provided
        if not end_date:
            end_date = datetime.utcnow()
        if not start_date:
            start_date = end_date - timedelta(days=30)  # Default to last 30 days
        
        # Base query
        query = self.db.query(User)
        
        # Apply tenant filter if provided
        if tenant_id:
            query = query.filter(User.tenant_id == tenant_id)
        
        # Get counts
        active_users = query.filter(User.is_active == True).count()
        inactive_users = query.filter(User.is_active == False).count()
        recent_logins = query.filter(
            User.last_login.between(start_date, end_date)
        ).count()
        
        return {
            "report_type": "user_activity",
            "data": {
                "active_users": active_users,
                "inactive_users": inactive_users,
                "recent_logins": recent_logins,
                "period": {
                    "start_date": start_date,
                    "end_date": end_date
                }
            }
        }
    
    def generate_system_health_report(self) -> Dict[str, Any]:
        """Generate system health report."""
        tenant_count = self.db.query(func.count(Tenant.id)).scalar()
        active_tenant_count = self.db.query(func.count(Tenant.id)).filter(Tenant.is_active == True).scalar()
        
        # This would be calculated dynamically in a real implementation
        # For now, we'll use placeholder values
        return {
            "report_type": "system_health",
            "data": {
                "tenant_count": tenant_count,
                "active_tenant_count": active_tenant_count,
                "database_size": "1.2 GB",  # Placeholder
                "system_uptime": "99.9%",    # Placeholder
                "api_requests_per_day": 5000  # Placeholder
            }
        }
