from fastapi import APIRouter, Depends, Request
from typing import List, Dict, Any
from sqlalchemy.orm import Session

from src.db.session import get_super_admin_db
from src.core.security.permissions import require_super_admin
from src.services.tenant.dashboard import DashboardMetricsService

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

@router.get("/tenant-stats")
async def get_tenant_stats(db: Session = Depends(get_super_admin_db)):
    service = DashboardMetricsService(db)
    metrics = service.get_tenant_growth_metrics()
    # Map service metrics to existing API response format
    return {
        "total": metrics["total_tenants"],
        "active": metrics["active_tenants"],
        "inactive": metrics["inactive_tenants"],
        "newThisMonth": metrics["new_tenants"],
        "growthRate": round(metrics["growth_rate"], 1)
    }

@router.get("/user-stats")
async def get_user_stats(db: Session = Depends(get_super_admin_db)):
    service = DashboardMetricsService(db)
    metrics = service.get_user_metrics()
    # Map service metrics to existing API response format
    return {
        "total": metrics["total_users"],
        "active": metrics["active_users"],
        "inactive": metrics["inactive_users"],
        "usersWithoutRoles": metrics["users_without_roles"],
        "avgPerTenant": round(metrics["average_users_per_tenant"], 1),
        "recentLogins": metrics["recent_logins"]
    }

@router.get("/revenue-by-tenant")
async def get_revenue_by_tenant(db: Session = Depends(get_super_admin_db)):
    service = DashboardMetricsService(db)
    return service.get_revenue_by_tenant()

@router.get("/system-metrics")
async def get_system_metrics(db: Session = Depends(get_super_admin_db)):
    service = DashboardMetricsService(db)
    metrics = service.get_system_overview()
    
    # Map service metrics to existing API response format
    return {
        "cpuUsage": metrics["system_health"]["cpuUsage"] if "cpuUsage" in metrics["system_health"] else 12,
        "memoryUsage": metrics["system_health"]["memoryUsage"] if "memoryUsage" in metrics["system_health"] else 45,
        "diskUsage": metrics["system_health"]["diskUsage"] if "diskUsage" in metrics["system_health"] else 62,
        "activeConnections": metrics["system_health"]["activeConnections"] if "activeConnections" in metrics["system_health"] else 156,
        "alerts": [],
        "tenantGrowth": metrics["tenant_metrics"].get("history", []), 
        "revenue_metrics": metrics["revenue_metrics"] 
    }

@router.get("/recent-tenants")
async def get_recent_tenants(limit: int = 5, db: Session = Depends(get_super_admin_db)):
    from src.db.models.auth.user import User
    from src.db.models.tenant.tenant import Tenant
    from sqlalchemy import func, desc
    
    # Join Tenant with User to get user counts
    query = (
        db.query(
            Tenant.id,
            Tenant.name,
            Tenant.domain,
            Tenant.is_active.label("isActive"),
            Tenant.created_at.label("createdAt"),
            Tenant.updated_at.label("updatedAt"),
            Tenant.plan_type,
            Tenant.plan_amount,
            Tenant.subscription_status,
            func.count(User.id).label("userCount")
        )
        .outerjoin(User, User.tenant_id == Tenant.id)
        .group_by(Tenant.id)
        .order_by(desc(Tenant.created_at))
        .limit(limit)
    )
    
    results = query.all()
    # Helper to convert Row objects to dict safely
    return [dict(r._asdict()) for r in results]

@router.get("/api-metadata")
async def get_api_metadata(
    request: Request,
    skip: int = 0,
    limit: int = 10,
    search: str = None
):
    """
    Get metadata for all available API endpoints.
    Grouped by path to avoid duplicates in the frontend list.
    """
    grouped_routes = {}
    for route in request.app.routes:
        if hasattr(route, "path") and hasattr(route, "methods"):
            # Skip noise/internal routes
            if any(p in route.path for p in ["/openapi.json", "/docs", "/redoc", "/static", "/test-cors", "api-metadata"]):
                continue
                
            path = route.path
            summary = getattr(route, "summary", "") or ""
            tags = getattr(route, "tags", []) or []
            
            # Simple search filter
            if search:
                search_lower = search.lower()
                if search_lower not in path.lower() and \
                   search_lower not in summary.lower() and \
                   not any(search_lower in tag.lower() for tag in tags):
                    continue
            
            if path not in grouped_routes:
                grouped_routes[path] = {
                    "path": path,
                    "methods": set(),
                    "summary": summary,
                    "description": getattr(route, "description", "") or "",
                    "tags": set(),
                    "status": "active"
                }
            
            # Merge methods and tags
            if route.methods:
                grouped_routes[path]["methods"].update(route.methods)
            if tags:
                grouped_routes[path]["tags"].update(tags)
                
            # Prefer summary if the first one was empty
            if not grouped_routes[path]["summary"] and summary:
                grouped_routes[path]["summary"] = summary
    
    # Convert sets to sorted lists
    routes_list = []
    for path, data in grouped_routes.items():
        data["methods"] = sorted(list(data["methods"]))
        data["tags"] = sorted(list(data["tags"]))
        routes_list.append(data)
    
    # Sort by path for consistency
    routes_list.sort(key=lambda x: x["path"])
    
    total = len(routes_list)
    paginated_results = routes_list[skip : skip + limit]
    
    return {
        "items": paginated_results,
        "total": total,
        "skip": skip,
        "limit": limit,
        "has_next": skip + limit < total,
        "has_prev": skip > 0
    }
