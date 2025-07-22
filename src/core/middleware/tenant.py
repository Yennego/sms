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
        try:
            tenant_id = UUID(x_tenant_id)
            tenant = db.query(Tenant).filter(
                Tenant.id == tenant_id,
                Tenant.is_active == True
            ).first()
            if tenant:
                print(f"Found tenant by ID: {tenant_id}")
        except ValueError:
            print(f"Invalid UUID in X-Tenant-ID: {x_tenant_id}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid tenant ID format"
            )
        
    
    # Strategy 2: Get from domain
    if not tenant:
        host = request.headers.get("host", "").split(":")[0]
        tenant = db.query(Tenant).filter(
            Tenant.domain == host,
            Tenant.is_active == True
        ).first()
        if tenant:
            print(f"Found tenant by domain: {host}")
    
    if not tenant:
        print(f"Tenant not found for X-Tenant-ID: {x_tenant_id} or domain: {host}")
        raise TenantNotFoundError(f"Tenant not found for X-Tenant-ID: {x_tenant_id} or domain: {host}")
    
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
        tenant_header = request.headers.get("X-Tenant-ID")
        tenant = None
        
        # Strategy 1: Get from header
        if tenant_header:
            try:
                tenant_id = UUID(tenant_header)
                tenant = db.query(Tenant).filter(
                    Tenant.id == tenant_id,
                    Tenant.is_active == True
                ).first()
                if tenant:
                    print(f"Middleware found tenant by ID: {tenant_id}")
            except ValueError:
                print(f"Invalid tenant UUID in X-Tenant-ID: {tenant_header}")
        
        # Strategy 2: Get from domain
        if not tenant:
            domain = request.headers.get("host", "").split(":")[0]
            tenant = db.query(Tenant).filter(
                Tenant.domain == domain,
                Tenant.is_active == True
            ).first()
            if tenant:
                print(f"Middleware found tenant by domain: {domain}")
        
        if tenant and tenant.is_active:
            # Set tenant ID in context
            set_tenant_id(str(tenant.id))
            response = await call_next(request)
            return response
        else:
            print(f"Middleware tenant not found for X-Tenant-ID: {tenant_header} or domain: {domain}")
            return HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tenant not found or inactive"
            )
    except Exception as e:
        print(f"Middleware error: {str(e)}")
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