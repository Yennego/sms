from fastapi import Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session
from typing import Optional, Union
from uuid import UUID
from fastapi.security import APIKeyHeader
from fastapi.responses import JSONResponse

from src.db.session import get_db, set_tenant_id, get_tenant_id
from src.db.models.tenant import Tenant
from src.core.exceptions import TenantNotFoundError

# In-memory cache for tenants to avoid DB hits on every request
TENANT_CACHE = {}

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
    host = request.headers.get("host", "").split(":")[0]
    
    print(f"[TENANT] Resolving tenant - X-Tenant-ID: {x_tenant_id}, Host: {host}")
    
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
                print(f"[TENANT] Found tenant by ID: {tenant_uuid} - {tenant.name}")
        except ValueError:
            # If not a UUID, try as code (matches Tenant.code)
            tenant = db.query(Tenant).filter(
                Tenant.code == x_tenant_id.upper(),
                Tenant.is_active == True
            ).first()
            if tenant:
                print(f"[TENANT] Found tenant by code: {x_tenant_id} - {tenant.name}")
            else:
                # Try as domain name
                tenant = db.query(Tenant).filter(
                    Tenant.domain == x_tenant_id.lower(),
                    Tenant.is_active == True
                ).first()
                if tenant:
                    print(f"[TENANT] Found tenant by domain in header: {x_tenant_id} - {tenant.name}")

    # Strategy 2: Get from domain
    if not tenant and host:
        tenant = db.query(Tenant).filter(
            Tenant.domain == host,
            Tenant.is_active == True
        ).first()
        if tenant:
            print(f"[TENANT] Found tenant by host domain: {host} - {tenant.name}")

    # Strategy 3: Special handling for Foundation tenant
    if not tenant and (x_tenant_id == "Foundation" or host == "Foundation"):
        tenant = db.query(Tenant).filter(
            Tenant.name == "Foundation",
            Tenant.is_active == True
        ).first()
        if tenant:
            print(f"[TENANT] Found Foundation tenant by name: {tenant.name}")

    # Strategy 4: Development fallback for localhost
    if not tenant and host in ["localhost", "127.0.0.1"]:
        # Try to find Foundation tenant first
        tenant = db.query(Tenant).filter(
            Tenant.name == "Foundation",
            Tenant.is_active == True
        ).first()
        if tenant:
            print(f"[TENANT] Development fallback: Using Foundation tenant for localhost")
        else:
            # Fallback to first active tenant
            tenant = db.query(Tenant).filter(
                Tenant.is_active == True
            ).first()
            if tenant:
                print(f"[TENANT] Development fallback: Using first active tenant: {tenant.name}")

    if not tenant:
        print(f"[TENANT] ERROR: Tenant not found for X-Tenant-ID: {x_tenant_id}, Host: {host}")
        # List available tenants for debugging
        available_tenants = db.query(Tenant).filter(Tenant.is_active == True).all()
        print(f"[TENANT] Available active tenants: {[(t.name, t.domain, str(t.id)) for t in available_tenants]}")
        raise TenantNotFoundError("Tenant not found")
    
    print(f"[TENANT] Setting tenant context: {tenant.id} - {tenant.name}")
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
    
    # Skip non-API routes, docs, and OpenAPI
    if (
        not path.startswith("/api/")
        or "openapi.json" in path
        or path.startswith("/docs")
        or path.startswith("/redocs")
        or path == "/favicon.ico"
        or path.startswith("/static/")
        or path.startswith("/api/v1/tenants/")
        or path.startswith("/api/tenant/")
        or path.startswith("/api/v1/auth/")
    ):
        return await call_next(request)
    
    tenant_header = request.headers.get("X-Tenant-ID")
    domain = request.headers.get("host", "").split(":")[0]
    
    # Check Cache First
    cache_key = f"{tenant_header}:{domain}"
    if cache_key in TENANT_CACHE:
        t_id, t_domain = TENANT_CACHE[cache_key]
        print(f"[TENANT MW] Cached hit for {cache_key} -> {t_id}") # ADDED
        set_tenant_id(t_id)
        return await call_next(request)

    print(f"[TENANT MW] Resolving tenant for path: {path}, Header: {tenant_header}, Domain: {domain}") # ADDED
    tenant = None
    db = next(get_db())
    try:
        # Strategy 1: Get from header
        if tenant_header:
            try:
                tenant_uuid = UUID(tenant_header)
                tenant = db.query(Tenant).filter(Tenant.id == tenant_uuid, Tenant.is_active == True).first()
            except ValueError:
                tenant = db.query(Tenant).filter(Tenant.code == tenant_header.upper(), Tenant.is_active == True).first()

        # Strategy 2: Get from domain
        if not tenant:
            tenant = db.query(Tenant).filter(Tenant.domain == domain, Tenant.is_active == True).first()
            if not tenant and domain == "localhost":
                tenant = db.query(Tenant).filter(Tenant.is_active == True).first()
        
        # Strategy 3: Path/Referer fallback (simplified)
        if not tenant:
            referer = request.headers.get("referer", "")
            if referer:
                from urllib.parse import urlparse
                path_segments = urlparse(referer).path.strip('/').split('/')
                if path_segments and path_segments[0]:
                    slug = path_segments[0]
                    try:
                        tenant = db.query(Tenant).filter(Tenant.id == UUID(slug), Tenant.is_active == True).first()
                    except ValueError:
                        tenant = db.query(Tenant).filter(Tenant.domain == slug, Tenant.is_active == True).first()

        if tenant:
            # Update Cache
            TENANT_CACHE[cache_key] = (tenant.id, tenant.domain)
            set_tenant_id(tenant.id)
            # Re-fetch ID for context before closing db
            t_id = tenant.id
        else:
            t_id = None
            
    finally:
        db.close() # CRITICAL: Release connection BEFORE calling next

    if t_id:
        return await call_next(request)
    
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={"detail": "Tenant not found or inactive"}
    )
