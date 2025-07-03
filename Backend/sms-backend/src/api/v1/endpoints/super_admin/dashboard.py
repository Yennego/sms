from fastapi import APIRouter, Depends
from typing import List

from src.db.session import get_super_admin_db
from src.core.security.permissions import require_super_admin
from src.db.models.auth.user import User

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

@router.get("/recent-tenants")
async def get_recent_tenants(limit: int = 5):
    return [{"id": "1", "name": "Tenant 1", "domain": "example.com", "isActive": True, "createdAt": "2023-01-01", "updatedAt": "2023-01-01", "userCount": 10}]

@router.get("/tenant-stats")
async def get_tenant_stats():
    return {"total": 10, "active": 8, "inactive": 2, "newThisMonth": 1, "growthRate": 0.1}

@router.get("/user-stats")
async def get_user_stats():
    return {"total": 100, "active": 80, "inactive": 20, "avgPerTenant": 10, "recentLogins": 5}

@router.get("/system-metrics")
async def get_system_metrics():
    return {"cpuUsage": 0.5, "memoryUsage": 0.6, "diskUsage": 0.7, "activeConnections": 10, "alerts": [], "tenantGrowth": []}