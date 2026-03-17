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
    
    def get_tenant_growth_history(self, months: int = 6) -> List[Dict[str, Any]]:
        """Get cumulative tenant growth history for charts."""
        history = []
        now = datetime.now(timezone.utc)
        for i in range(months-1, -1, -1):
            # Calculate the end of the month for that period
            # For simplicity, we use 30-day blocks back from now
            period_end = now - timedelta(days=i*30)
            month_label = period_end.strftime("%b")
            
            count = self.db.query(func.count(Tenant.id)).filter(
                Tenant.created_at <= period_end
            ).scalar() or 0
            
            history.append({
                "month": month_label,
                "tenants": count
            })
        return history

    def get_tenant_growth_metrics(self, period_days: int = 30) -> Dict[str, Any]:
        """Get tenant growth metrics over time."""
        end_date = datetime.now(timezone.utc)
        start_date = end_date - timedelta(days=period_days)
        
        # Get total tenant count
        total_tenants = self.db.query(func.count(Tenant.id)).scalar() or 0
        
        # Get new tenants in period
        new_tenants = self.db.query(func.count(Tenant.id)).filter(
            Tenant.created_at.between(start_date, end_date)
        ).scalar() or 0
        
        # Get active vs inactive tenants
        active_tenants = self.db.query(func.count(Tenant.id)).filter(Tenant.is_active == True).scalar() or 0
        inactive_tenants = total_tenants - active_tenants
        
        # Calculate growth history for charts
        history = self.get_tenant_growth_history()
        
        return {
            "total_tenants": total_tenants,
            "new_tenants": new_tenants,
            "active_tenants": active_tenants,
            "inactive_tenants": inactive_tenants,
            "growth_rate": (new_tenants / (total_tenants - new_tenants) * 100) if (total_tenants - new_tenants) > 0 else 0,
            "period_days": period_days,
            "history": history
        }
    
    def get_user_metrics(self) -> Dict[str, Any]:
        """Get user-related metrics across all tenants."""
        # Total users
        total_users = self.db.query(func.count(User.id)).scalar()
        
        # Active users
        active_users = self.db.query(func.count(User.id)).filter(User.is_active == True).scalar()
        
        # Users without roles
        from src.db.models.auth.user_role import UserRole
        from sqlalchemy import not_
        users_without_roles = self.db.query(func.count(User.id)).filter(
            User.is_active == True,
            not_(User.roles.any())
        ).scalar() or 0
        
        # Users per tenant (average) - Fixed to avoid nested aggregates
        subquery = select(User.tenant_id, func.count(User.id).label('user_count')).group_by(User.tenant_id).subquery()
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
            "users_without_roles": users_without_roles,
            "average_users_per_tenant": round(users_per_tenant, 2),
            "recent_logins": recent_logins
        }
    
    def get_revenue_metrics(self) -> Dict[str, Any]:
        """Calculate estimated monthly revenue based on tenant plans, excluding super admins and users with no roles."""
        # Get all active tenants with their plan details
        active_tenants = self.db.query(Tenant).filter(Tenant.is_active == True).all()
        
        total_revenue = 0.0
        flat_rate_revenue = 0.0
        per_user_revenue = 0.0
        
        # To calculate per-user revenue, we need billable user counts per tenant
        # Billable = Active AND (Has at least one role) AND (NOT super-admin)
        from src.db.models.auth.user_role import UserRole
        from sqlalchemy import not_
        
        user_counts_query = (
            self.db.query(User.tenant_id, func.count(User.id))
            .filter(
                User.is_active == True,
                User.roles.any(), # MUST have at least one role
                not_(User.roles.any(UserRole.name.in_(['super-admin', 'superadmin'])))
            )
            .group_by(User.tenant_id)
            .all()
        )
        user_counts = {str(tid): count for tid, count in user_counts_query}
        
        for tenant in active_tenants:
            amount = float(tenant.plan_amount or 0.0)
            t_id_str = str(tenant.id)
            
            if tenant.plan_type == "flat_rate":
                flat_rate_revenue += amount
                total_revenue += amount
            elif tenant.plan_type == "per_user":
                user_count = user_counts.get(t_id_str, 0)
                tenant_revenue = amount * user_count
                per_user_revenue += tenant_revenue
                total_revenue += tenant_revenue
        
        return {
            "total_monthly_revenue": round(total_revenue, 2),
            "flat_rate_revenue": round(flat_rate_revenue, 2),
            "per_user_revenue": round(per_user_revenue, 2),
            "currency": "USD"
        }

    def get_revenue_by_tenant(self) -> List[Dict[str, Any]]:
        """Get a per-tenant breakdown of revenue, excluding users with no roles."""
        from src.db.models.auth.user_role import UserRole
        from sqlalchemy import not_
        
        active_tenants = self.db.query(Tenant).filter(Tenant.is_active == True).all()
        
        # Billable users: Active, HAS role, and NOT super-admin
        user_counts_query = (
            self.db.query(User.tenant_id, func.count(User.id))
            .filter(
                User.is_active == True,
                User.roles.any(), # MUST have at least one role
                not_(User.roles.any(UserRole.name.in_(['super-admin', 'superadmin'])))
            )
            .group_by(User.tenant_id)
            .all()
        )
        user_counts = {str(tid): count for tid, count in user_counts_query}
        
        breakdown = []
        for tenant in active_tenants:
            amount = float(tenant.plan_amount or 0.0)
            user_count = user_counts.get(str(tenant.id), 0)
            
            revenue = 0.0
            if tenant.plan_type == "flat_rate":
                revenue = amount
            elif tenant.plan_type == "per_user":
                revenue = amount * user_count
                
            breakdown.append({
                "tenant_id": str(tenant.id),
                "tenant_name": tenant.name,
                "plan_type": tenant.plan_type,
                "plan_amount": amount,
                "billable_users": user_count,
                "monthly_revenue": round(revenue, 2)
            })
            
        return breakdown
    
    def get_system_overview(self) -> Dict[str, Any]:
        """Get system overview metrics for the dashboard."""
        # Combine tenant, user and revenue metrics
        tenant_metrics = self.get_tenant_growth_metrics()
        user_metrics = self.get_user_metrics()
        revenue_metrics = self.get_revenue_metrics()
        
        # Add additional system metrics
        return {
            "tenant_metrics": tenant_metrics,
            "user_metrics": user_metrics,
            "revenue_metrics": revenue_metrics,
            "system_health": {
                "database_size": "1.2 GB",  # Placeholder
                "system_uptime": "99.9%",    # Placeholder
                "api_requests_per_day": 5000  # Placeholder
            }
        }