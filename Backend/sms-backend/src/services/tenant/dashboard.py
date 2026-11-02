from typing import Dict, Any, List, Optional
from uuid import UUID
from datetime import datetime, timedelta, timezone
from sqlalchemy import func, select

from src.db.models.auth import User
from src.db.models.tenant import Tenant
from src.services.base.base import SuperAdminBaseService

import time as _time

_PROCESS_STARTED = _time.time()  # for the platform's System health page

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
        """Platform billing totals per currency (phase7-design.md §5 summary): billed, collected and
        outstanding, plus what was received in the last 30 days. Amounts are strings ("120.00")."""
        from src.services.billing.platform_billing import BillingService
        from src.services.finance.ledger import money
        billing = BillingService(self.db)
        summary = billing.summary()
        since = datetime.now(timezone.utc) - timedelta(days=30)
        recent = billing.collected_usd_since(since)
        return {
            "billed": summary["billed"],
            "collected": summary["collected"],
            "outstanding": summary["outstanding"],
            "not_yet_paid": summary["not_yet_paid"],
            "collected_usd_last_30_days": money(sum(recent.values())) if recent else "0.00",
        }

    def get_revenue_by_tenant(self) -> List[Dict[str, Any]]:
        """Per active school: billing status, staff count, amount due and USD received in the last 30 days."""
        from src.db.models.billing import SchoolSubscription
        from src.services.billing.platform_billing import BillingService
        from src.services.finance.ledger import money, money_map

        billing = BillingService(self.db)
        since = datetime.now(timezone.utc) - timedelta(days=30)
        recent = billing.collected_usd_since(since)
        statuses = dict(self.db.query(SchoolSubscription.tenant_id, SchoolSubscription.status).all())
        breakdown = []
        for tenant in self.db.query(Tenant).filter(Tenant.is_active == True).order_by(Tenant.name).all():
            breakdown.append({
                "tenant_id": str(tenant.id),
                "tenant_name": tenant.name,
                "billing_status": statuses.get(tenant.id, "trial"),
                "staff_count": billing.staff_count(tenant.id),
                "amount_due": money_map(billing.account(tenant.id)["amount_due"]),
                "collected_usd_last_30_days": money(recent.get(tenant.id, 0)),
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
            "system_health": self.get_system_health(),
        }

    def get_system_health(self) -> Dict[str, Any]:
        """What can actually be measured from here: the database's size, open connections and
        response time, and how long this API process has been up. Host CPU, memory and disk aren't
        visible to the app on managed hosting, so they are left out rather than invented."""
        import time
        from sqlalchemy import text
        health: Dict[str, Any] = {"api_uptime_seconds": int(time.time() - _PROCESS_STARTED),
                                  "database_size_bytes": None, "database_connections": None, "database_ms": None}
        try:
            started = time.perf_counter()
            self.db.execute(text("SELECT 1"))
            health["database_ms"] = round((time.perf_counter() - started) * 1000, 1)
            if self.db.get_bind().dialect.name == "postgresql":
                health["database_size_bytes"] = self.db.execute(
                    text("SELECT pg_database_size(current_database())")).scalar()
                health["database_connections"] = self.db.execute(
                    text("SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()")).scalar()
        except Exception:
            pass  # a health page must not fail because one figure can't be read
        return health