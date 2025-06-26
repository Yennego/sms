from fastapi import Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session
from typing import Optional, Union
from uuid import UUID
from fastapi.security import APIKeyHeader

from src.db.session import get_db, set_tenant_id
from src.db.models.tenant import Tenant
from src.core.exceptions import TenantNotFoundError

X_TENANT_ID = APIKeyHeader(name="X-Tenant-ID", auto_error=False)


async def get_tenant_header(x_tenant_id: Optional[str] = Header(None, alias="X-Tenant-ID")) -> Optional[str]:
    """Extract tenant ID from request header."""
    return x_tenant_id


async def get_tenant_from_domain(request: Request) -> Optional[str]:
    """Extract tenant from domain or subdomain."""
    host = request.headers.get("host", "")
    if not host:
        return None
    
    # Remove port if present
    domain = host.split(":")[0]
    return domain


async def get_tenant_from_request(
    request: Request,
    x_tenant_id: Optional[str] = Depends(X_TENANT_ID),
    db: Session = Depends(get_db)
) -> Tenant:
    """
    Get tenant from request using multiple strategies:
    1. X-Tenant-ID header
    2. Domain/subdomain
    """
    tenant = None
    
    # Strategy 1: Get from header
    if x_tenant_id:
        tenant = db.query(Tenant).filter(
            Tenant.slug == x_tenant_id,
            Tenant.is_active == True
        ).first()
    
    # Strategy 2: Get from domain
    if not tenant:
        host = request.headers.get("host", "").split(":")[0]
        tenant = db.query(Tenant).filter(
            Tenant.domain == host,
            Tenant.is_active == True
        ).first()
    
    if not tenant:
        raise TenantNotFoundError("Tenant not found")
    
    # Set tenant ID in context
    set_tenant_id(str(tenant.id))
    
    return tenant


async def tenant_middleware(request: Request, call_next):
    """Middleware to extract tenant from request and set in context."""
    # Skip tenant identification for non-API routes or tenant management endpoints
    path = request.url.path
    if not path.startswith("/api/") or path.startswith("/api/v1/tenants/"):
        return await call_next(request)
    
    try:
        # Create a new database session
        db = next(get_db())
        
        # Try to identify tenant
        tenant_header = request.headers.get("X-Tenant-ID")
        tenant = None
        
        # Strategy 1: Get from header
        if tenant_header:
            tenant = db.query(Tenant).filter(Tenant.slug == tenant_header).first()
        
        # Strategy 2: Get from domain
        if not tenant:
            domain = request.headers.get("host", "").split(":")[0]
            tenant = db.query(Tenant).filter(Tenant.domain == domain).first()
        
        if tenant and tenant.is_active:
            # Set tenant ID in context
            set_tenant_id(str(tenant.id))
            response = await call_next(request)
            return response
        else:
            return HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tenant not found or inactive"
            )
    except Exception as e:
        return HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
    finally:
        db.close()


def get_tenant_id_from_request(
    tenant: Union[Tenant, dict] = Depends(get_tenant_from_request),
) -> Union[str, UUID]:
    """Get tenant ID from request as a dependency."""
    if isinstance(tenant, dict):
        return tenant["id"]
    return tenant.id