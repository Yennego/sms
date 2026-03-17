"""
Predictive Analytics Service for the Super Admin Dashboard.

Provides:
- Growth Forecasting (linear regression on tenant/user/revenue data)
- Anomaly Detection (standard deviation from rolling averages)
- Churn Prediction (weighted engagement scoring per tenant)
"""
from typing import Dict, Any, List
from datetime import datetime, timedelta, timezone
from sqlalchemy import func, not_
import numpy as np

from src.db.models.auth import User
from src.db.models.auth.user_role import UserRole
from src.db.models.tenant import Tenant
from src.db.models.logging.activity_log import ActivityLog


class PredictiveAnalyticsService:
    """Service for AI-powered predictive analytics on the Super Admin dashboard."""

    def __init__(self, db):
        self.db = db

    # ─── Growth Forecasting ──────────────────────────────────────────

    def get_growth_forecast(self, history_months: int = 12, forecast_months: int = 3) -> Dict[str, Any]:
        """
        Forecast tenant growth, user growth, and revenue using linear regression.
        Returns historical data + projected future data points.
        """
        now = datetime.now(timezone.utc)

        # ── Tenant Growth History ──
        tenant_history = []
        for i in range(history_months - 1, -1, -1):
            period_end = now - timedelta(days=i * 30)
            count = self.db.query(func.count(Tenant.id)).filter(
                Tenant.created_at <= period_end
            ).scalar() or 0
            tenant_history.append({
                "month": period_end.strftime("%b %Y"),
                "value": count,
                "type": "historical"
            })

        # ── User Growth History ──
        user_history = []
        for i in range(history_months - 1, -1, -1):
            period_end = now - timedelta(days=i * 30)
            count = self.db.query(func.count(User.id)).filter(
                User.created_at <= period_end
            ).scalar() or 0
            user_history.append({
                "month": period_end.strftime("%b %Y"),
                "value": count,
                "type": "historical"
            })

        # ── Linear Regression Forecast ──
        tenant_forecast = self._forecast_linear(tenant_history, forecast_months, now)
        user_forecast = self._forecast_linear(user_history, forecast_months, now)

        # ── Revenue Forecast (based on tenant growth) ──
        avg_revenue_per_tenant = self._get_avg_revenue_per_tenant()
        revenue_history = [
            {"month": h["month"], "value": round(h["value"] * avg_revenue_per_tenant, 2), "type": "historical"}
            for h in tenant_history
        ]
        revenue_forecast = [
            {"month": f["month"], "value": round(f["value"] * avg_revenue_per_tenant, 2), "type": "forecast"}
            for f in tenant_forecast
        ]

        return {
            "tenants": {
                "history": tenant_history,
                "forecast": tenant_forecast,
                "current": tenant_history[-1]["value"] if tenant_history else 0,
                "projected": tenant_forecast[-1]["value"] if tenant_forecast else 0,
            },
            "users": {
                "history": user_history,
                "forecast": user_forecast,
                "current": user_history[-1]["value"] if user_history else 0,
                "projected": user_forecast[-1]["value"] if user_forecast else 0,
            },
            "revenue": {
                "history": revenue_history,
                "forecast": revenue_forecast,
                "current": revenue_history[-1]["value"] if revenue_history else 0,
                "projected": revenue_forecast[-1]["value"] if revenue_forecast else 0,
            }
        }

    def _forecast_linear(self, history: List[Dict], forecast_months: int, now: datetime) -> List[Dict]:
        """Apply simple linear regression to project future data points."""
        if len(history) < 2:
            return []

        values = np.array([h["value"] for h in history], dtype=float)
        x = np.arange(len(values), dtype=float)

        # Linear regression: y = mx + b
        n = len(x)
        sum_x = np.sum(x)
        sum_y = np.sum(values)
        sum_xy = np.sum(x * values)
        sum_x2 = np.sum(x ** 2)

        denominator = (n * sum_x2 - sum_x ** 2)
        if denominator == 0:
            slope = 0.0
            intercept = float(np.mean(values))
        else:
            slope = float((n * sum_xy - sum_x * sum_y) / denominator)
            intercept = float((sum_y - slope * sum_x) / n)

        forecast = []
        for i in range(1, forecast_months + 1):
            future_x = len(values) - 1 + i
            projected_value = max(0, round(slope * future_x + intercept))
            future_date = now + timedelta(days=i * 30)
            forecast.append({
                "month": future_date.strftime("%b %Y"),
                "value": projected_value,
                "type": "forecast"
            })

        return forecast

    def _get_avg_revenue_per_tenant(self) -> float:
        """Calculate average revenue per active tenant."""
        active_tenants = self.db.query(Tenant).filter(Tenant.is_active == True).all()
        if not active_tenants:
            return 0.0

        total_revenue = 0.0
        tenant_count = 0

        # Billable users per tenant
        user_counts_query = (
            self.db.query(User.tenant_id, func.count(User.id))
            .filter(
                User.is_active == True,
                User.roles.any(),
                not_(User.roles.any(UserRole.name.in_(['super-admin', 'superadmin'])))
            )
            .group_by(User.tenant_id)
            .all()
        )
        user_counts = {str(tid): count for tid, count in user_counts_query}

        for tenant in active_tenants:
            amount = float(tenant.plan_amount or 0.0)
            if tenant.plan_type == "flat_rate":
                total_revenue += amount
            elif tenant.plan_type == "per_user":
                total_revenue += amount * user_counts.get(str(tenant.id), 0)
            tenant_count += 1

        return total_revenue / tenant_count if tenant_count > 0 else 0.0

    # ─── Anomaly Detection ───────────────────────────────────────────

    def get_anomaly_alerts(self) -> List[Dict[str, Any]]:
        """
        Detect anomalies by comparing recent per-tenant activity against 
        30-day rolling averages. Flags deviations > 2 standard deviations.
        """
        now = datetime.now(timezone.utc)
        seven_days_ago = now - timedelta(days=7)
        thirty_days_ago = now - timedelta(days=30)

        alerts = []

        # ── Per-Tenant Activity Anomaly ──
        active_tenants = self.db.query(Tenant).filter(Tenant.is_active == True).all()

        for tenant in active_tenants:
            tid = tenant.id

            # 30-day daily activity counts
            daily_counts_30d = []
            for day_offset in range(30):
                day_start = thirty_days_ago + timedelta(days=day_offset)
                day_end = day_start + timedelta(days=1)
                count = self.db.query(func.count(ActivityLog.id)).filter(
                    ActivityLog.tenant_id == tid,
                    ActivityLog.created_at.between(day_start, day_end)
                ).scalar() or 0
                daily_counts_30d.append(count)

            if not daily_counts_30d or all(c == 0 for c in daily_counts_30d):
                # Zero-activity tenant — flag it
                alerts.append({
                    "tenant_id": str(tid),
                    "tenant_name": tenant.name,
                    "type": "zero_activity",
                    "severity": "warning",
                    "message": f"{tenant.name} has had zero activity in the last 30 days.",
                    "metric": {"activity_30d": 0}
                })
                continue

            avg = float(np.mean(daily_counts_30d))
            std = float(np.std(daily_counts_30d))

            # Recent 7-day average
            recent_daily_avg = float(np.mean(daily_counts_30d[-7:]))

            if std > 0 and abs(recent_daily_avg - avg) > 2 * std:
                direction = "spike" if recent_daily_avg > avg else "drop"
                severity = "error" if direction == "drop" else "info"
                alerts.append({
                    "tenant_id": str(tid),
                    "tenant_name": tenant.name,
                    "type": f"activity_{direction}",
                    "severity": severity,
                    "message": f"{tenant.name}: Activity {direction} detected. "
                               f"Recent avg: {recent_daily_avg:.1f}/day vs 30d avg: {avg:.1f}/day.",
                    "metric": {
                        "recent_avg": round(recent_daily_avg, 1),
                        "baseline_avg": round(avg, 1),
                        "std_dev": round(std, 1)
                    }
                })

        # ── Sudden User Deactivations ──
        recently_deactivated = self.db.query(
            User.tenant_id,
            func.count(User.id).label('count')
        ).filter(
            User.is_active == False,
            User.updated_at >= seven_days_ago
        ).group_by(User.tenant_id).all()

        for tid, count in recently_deactivated:
            if count >= 3:
                tenant = self.db.query(Tenant).filter(Tenant.id == tid).first()
                if tenant:
                    alerts.append({
                        "tenant_id": str(tid),
                        "tenant_name": tenant.name,
                        "type": "mass_deactivation",
                        "severity": "warning",
                        "message": f"{tenant.name}: {count} users deactivated in last 7 days.",
                        "metric": {"deactivated_count": count}
                    })

        return sorted(alerts, key=lambda a: {"error": 0, "warning": 1, "info": 2}.get(a["severity"], 3))

    # ─── Churn Prediction ────────────────────────────────────────────

    def get_churn_risk_tenants(self) -> List[Dict[str, Any]]:
        """
        Score each tenant 0-100 for churn risk based on weighted engagement factors.
        Higher score = higher risk.
        """
        now = datetime.now(timezone.utc)
        thirty_days_ago = now - timedelta(days=30)

        active_tenants = self.db.query(Tenant).filter(Tenant.is_active == True).all()
        churn_data = []

        for tenant in active_tenants:
            tid = tenant.id

            # Factor 1: Days since last login (any user in tenant) — Weight: 35%
            last_login_result = self.db.query(func.max(User.last_login)).filter(
                User.tenant_id == tid,
                User.is_active == True
            ).scalar()

            if last_login_result:
                days_since_login = (now - last_login_result.replace(tzinfo=timezone.utc)).days
            else:
                days_since_login = 999  # Never logged in

            login_score = min(100, (days_since_login / 30) * 100)  # 30 days = 100%

            # Factor 2: % of inactive users — Weight: 25%
            total_users = self.db.query(func.count(User.id)).filter(
                User.tenant_id == tid
            ).scalar() or 0

            inactive_users = self.db.query(func.count(User.id)).filter(
                User.tenant_id == tid,
                User.is_active == False
            ).scalar() or 0

            inactive_pct = (inactive_users / total_users * 100) if total_users > 0 else 0
            inactive_score = min(100, inactive_pct)

            # Factor 3: Activity trend (30d) — Weight: 25%
            activity_count = self.db.query(func.count(ActivityLog.id)).filter(
                ActivityLog.tenant_id == tid,
                ActivityLog.created_at >= thirty_days_ago
            ).scalar() or 0

            # Normalize: 0 activity = 100 risk, 100+ = 0 risk
            activity_score = max(0, min(100, 100 - activity_count))

            # Factor 4: Revenue tier — Weight: 15%
            revenue = float(tenant.plan_amount or 0.0)
            if tenant.plan_type == "per_user":
                user_count = self.db.query(func.count(User.id)).filter(
                    User.tenant_id == tid,
                    User.is_active == True,
                    User.roles.any()
                ).scalar() or 0
                revenue = revenue * user_count

            revenue_score = 100 if revenue == 0 else max(0, min(100, 100 - (revenue / 10)))

            # Weighted composite score
            churn_score = round(
                login_score * 0.35 +
                inactive_score * 0.25 +
                activity_score * 0.25 +
                revenue_score * 0.15
            )

            risk_level = "high" if churn_score >= 70 else ("medium" if churn_score >= 40 else "low")

            churn_data.append({
                "tenant_id": str(tid),
                "tenant_name": tenant.name,
                "churn_score": churn_score,
                "risk_level": risk_level,
                "factors": {
                    "days_since_login": days_since_login,
                    "inactive_users_pct": round(inactive_pct, 1),
                    "activity_30d": activity_count,
                    "monthly_revenue": round(revenue, 2)
                },
                "recommendation": self._get_churn_recommendation(risk_level, days_since_login, inactive_pct)
            })

        return sorted(churn_data, key=lambda d: d["churn_score"], reverse=True)

    def _get_churn_recommendation(self, risk_level: str, days_since_login: int, inactive_pct: float) -> str:
        """Generate actionable recommendation based on churn factors."""
        if risk_level == "high":
            if days_since_login > 30:
                return "Urgent: No logins in 30+ days. Reach out to admin for engagement."
            if inactive_pct > 50:
                return "High user deactivation rate. Investigate root cause."
            return "High churn risk. Schedule review meeting with tenant admin."
        elif risk_level == "medium":
            if days_since_login > 14:
                return "Declining engagement. Send re-engagement nudge."
            return "Monitor closely. Consider offering training or onboarding support."
        return "Healthy engagement. No action needed."
