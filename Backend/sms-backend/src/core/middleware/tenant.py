from fastapi import Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session
from typing import Optional, Union
from uuid import UUID
from fastapi.security import APIKeyHeader
from fastapi.responses import JSONResponse

from src.db.session import get_db, set_tenant_id, get_tenant_id
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
    return host.split(":")[0]

async def get_tenant_from_request(
    request: Request,
    x_tenant_id: Optional[str] = Depends(X_TENANT_ID),
    db: Session = Depends(get_db)
) -> Tenant:
    """Get tenant from request using multiple strategies: X-Tenant-ID (UUID or code), then domain."""
    tenant = None
    
    # Strategy 1: Get from header
    if x_tenant_id:
        try:
            # First, try as UUID (matches Tenant.id)
            tenant_uuid = UUID(x_tenant_id)
            tenant = db.query(Tenant).filter(
                Tenant.id == tenant_uuid,
                Tenant.is_active == True
            ).first()
            if tenant:
                print(f"Found tenant by ID: {tenant_uuid}")
        except ValueError:
            # If not a UUID, try as code (matches Tenant.code)
            tenant = db.query(Tenant).filter(
                Tenant.code == x_tenant_id.upper(),
                Tenant.is_active == True
            ).first()
            if tenant:
                print(f"Found tenant by code: {x_tenant_id}")

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
        raise TenantNotFoundError("Tenant not found")
    
    set_tenant_id(tenant.id)
    return tenant

async def get_optional_tenant_from_request(
    request: Request,
    x_tenant_id: Optional[str] = Depends(X_TENANT_ID),
    db: Session = Depends(get_db)
) -> Optional[Tenant]:
    """Get tenant optionally, returning None if not found."""
    tenant = None
    
    # Strategy 1: Check context (set by auth middleware)
    try:
        context_tenant_id = get_tenant_id()
        if context_tenant_id:
            tenant = db.query(Tenant).filter(
                Tenant.id == UUID(str(context_tenant_id)),
                Tenant.is_active == True
            ).first()
            if tenant:
                print(f"Found tenant by context ID: {context_tenant_id}")
                set_tenant_id(tenant.id)
                return tenant
    except (LookupError, ValueError):
        pass

    # Strategy 2: Get from header
    if x_tenant_id:
        try:
            tenant_uuid = UUID(x_tenant_id)
            tenant = db.query(Tenant).filter(
                Tenant.id == tenant_uuid,
                Tenant.is_active == True
            ).first()
        except ValueError:
            tenant = db.query(Tenant).filter(
                Tenant.code == x_tenant_id.upper(),
                Tenant.is_active == True
            ).first()
        if tenant:
            print(f"Found tenant by header: {x_tenant_id}")
            set_tenant_id(tenant.id)
            return tenant

    # Strategy 3: Get from domain
    if not tenant:
        host = request.headers.get("host", "").split(":")[0]
        tenant = db.query(Tenant).filter(
            Tenant.domain == host,
            Tenant.is_active == True
        ).first()
        if tenant:
            print(f"Found tenant by domain: {host}")
            set_tenant_id(tenant.id)

    return tenant

def get_tenant_id_from_request(
    tenant: Union[Tenant, dict] = Depends(get_tenant_from_request),
) -> Union[str, UUID]:
    """Get tenant ID from request as a dependency."""
    if isinstance(tenant, dict):
        return tenant["id"]
    return tenant.id

def get_optional_tenant_id_from_request(
    tenant: Optional[Tenant] = Depends(get_optional_tenant_from_request),
) -> Optional[str]:
    """Get tenant ID optionally, returning None if no tenant found."""
    if tenant:
        return str(tenant.id)
    try:
        context_tenant_id = get_tenant_id()
        return str(context_tenant_id) if context_tenant_id else None
    except LookupError:
        return None

async def tenant_middleware(request: Request, call_next):
    """Middleware to extract tenant from request and set in context."""
    path = request.url.path
    # Skip non-API routes, tenant management, auth, and allow dashboard stats
    if (not path.startswith("/api/") or
        path.startswith("/api/v1/tenants/") and not path == "/api/v1/tenants/dashboard/stats" or
        path.startswith("/api/tenant/") or
        path.startswith("/api/v1/auth/")):
        return await call_next(request)
    
    try:
        db = next(get_db())
        tenant_header = request.headers.get("X-Tenant-ID")
        tenant = None
        
        # Strategy 1: Get from header
        if tenant_header:
            try:
                tenant_uuid = UUID(tenant_header)
                tenant = db.query(Tenant).filter(
                    Tenant.id == tenant_uuid,
                    Tenant.is_active == True
                ).first()
            except ValueError:
                tenant = db.query(Tenant).filter(
                    Tenant.code == tenant_header.upper(),
                    Tenant.is_active == True
                ).first()
            if tenant:
                print(f"Middleware found tenant by header: {tenant_header}")

        # Strategy 2: Get from domain if no header match
        if not tenant:
            domain = request.headers.get("host", "").split(":")[0]
            tenant = db.query(Tenant).filter(
                Tenant.domain == domain,
                Tenant.is_active == True
            ).first()
            if tenant:
                print(f"Middleware found tenant by domain: {domain}")

        if tenant and tenant.is_active:
            set_tenant_id(tenant.id)
            response = await call_next(request)
            return response
        else:
            print(f"Middleware tenant not found for X-Tenant-ID: {tenant_header} or domain: {domain}")
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content={"detail": "Tenant not found or inactive"}
            )
    except Exception as e:
        print(f"Middleware error: {str(e)}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": str(e)}
        )
    finally:
        db.close()