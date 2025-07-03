from typing import Dict, Any, List, Optional
from uuid import UUID
from datetime import datetime, timedelta, timezone
from sqlalchemy import func, select

from src.db.models.auth import User
from src.db.models.tenant import Tenant
from src.services.base.base import SuperAdminBaseService

class DashboardMetricsService:
    """
    Service for providing aggregated statistics for the super-admin dashboard.
    """
    def __init__(self, db):
        """
        Initialize the dashboard metrics service with just the database session.
        This service doesn't need the crud and model parameters that SuperAdminBaseService requires.
        """
        self.db = db
    
    def get_tenant_growth_metrics(self, period_days: int = 30) -> Dict[str, Any]:
        """Get tenant growth metrics over time."""
        end_date = datetime.now(timezone.utc)
        start_date = end_date - timedelta(days=period_days)
        
        # Get total tenant count
        total_tenants = self.db.query(func.count(Tenant.id)).scalar()
        
        # Get new tenants in period
        new_tenants = self.db.query(func.count(Tenant.id)).filter(
            Tenant.created_at.between(start_date, end_date)
        ).scalar()
        
        # Get active vs inactive tenants
        active_tenants = self.db.query(func.count(Tenant.id)).filter(Tenant.is_active == True).scalar()
        inactive_tenants = total_tenants - active_tenants
        
        return {
            "total_tenants": total_tenants,
            "new_tenants": new_tenants,
            "active_tenants": active_tenants,
            "inactive_tenants": inactive_tenants,
            "growth_rate": (new_tenants / total_tenants) * 100 if total_tenants > 0 else 0,
            "period_days": period_days
        }
    
    def get_user_metrics(self) -> Dict[str, Any]:
        """Get user-related metrics across all tenants."""
        # Total users
        total_users = self.db.query(func.count(User.id)).scalar()
        
        # Active users
        active_users = self.db.query(func.count(User.id)).filter(User.is_active == True).scalar()
        
        # Users per tenant (average) - Fixed to avoid nested aggregates
        # First, get a count of users per tenant
        subquery = select(User.tenant_id, func.count(User.id).label('user_count')).group_by(User.tenant_id).subquery()
        # Then, calculate the average of those counts
        users_per_tenant = self.db.query(func.avg(subquery.c.user_count)).scalar() or 0
        
        # Recent logins (last 24 hours)
        yesterday = datetime.now(timezone.utc) - timedelta(days=1)
        recent_logins = self.db.query(func.count(User.id)).filter(
            User.last_login >= yesterday
        ).scalar()
        
        return {
            "total_users": total_users,
            "active_users": active_users,
            "inactive_users": total_users - active_users,
            "average_users_per_tenant": round(users_per_tenant, 2),
            "recent_logins": recent_logins
        }
    
    def get_system_overview(self) -> Dict[str, Any]:
        """Get system overview metrics for the dashboard."""
        # Combine tenant and user metrics
        tenant_metrics = self.get_tenant_growth_metrics()
        user_metrics = self.get_user_metrics()
        
        # Add additional system metrics
        return {
            "tenant_metrics": tenant_metrics,
            "user_metrics": user_metrics,
            "system_health": {
                "database_size": "1.2 GB",  # Placeholder
                "system_uptime": "99.9%",    # Placeholder
                "api_requests_per_day": 5000  # Placeholder
            }
        }