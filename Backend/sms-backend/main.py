import logfire
from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from fastapi.staticfiles import StaticFiles
from fastapi.openapi.utils import get_openapi 

from src.api.v1.api import api_router
from src.core.config import settings
from src.core.logging import setup_logging
from src.core.middleware.audit_middleware import AuditLoggingMiddleware
from src.core.middleware.tenant import tenant_middleware  
from src.core.middleware.idle_activity import IdleActivityMiddleware
from datetime import datetime
import traceback
from fastapi.responses import JSONResponse

# Initialize Logfire
try:
    if settings.LOGFIRE_TOKEN:
        logfire.configure(
            token=settings.LOGFIRE_TOKEN,
            project_name=settings.LOGFIRE_PROJECT_NAME,
            send_to_logfire=True
        )
    else:
        logfire.configure(send_to_logfire=False)
except Exception as e:
    print(f"⚠️ Logfire configuration failed, falling back to console only: {e}")
    logfire.configure(send_to_logfire=False)

setup_logging()

from src.core.redis import cache

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Connect to Redis on startup
    await cache.connect()
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    description=settings.PROJECT_DESCRIPTION,
    version=settings.PROJECT_VERSION,
    # API docs are only served in development (DEBUG=true)
    openapi_url=f"{settings.API_V1_STR}/openapi.json" if settings.DEBUG else None,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redocs" if settings.DEBUG else None,
    lifespan=lifespan,
    debug=settings.DEBUG,
    redirect_slashes=False,      
)

# Instrument FastAPI with Logfire
# logfire.instrument_fastapi(app, capture_headers=True)

@app.exception_handler(Exception)
async def debug_exception_handler(request: Request, exc: Exception):
    # Log to a file as well for retrieval
    import os
    os.makedirs("tmp", exist_ok=True)
    with open("tmp/backend_errors.log", "a") as f:
        f.write(f"\n\n--- ERROR: {type(exc).__name__} at {datetime.now()} ---\n")
        f.write(traceback.format_exc())
    
    # Internals (exception text, type, traceback) stay in the log, never in the response
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected server error occurred."}
    )

from sqlalchemy.exc import IntegrityError

# Unique rules people can trip over, by constraint name: answer 409 with what to change
DUPLICATE_MESSAGES = {
    "uq_users_tenant_username": "That username is already used in this school. Choose another.",
    "uq_users_tenant_email": "That email is already used in this school.",
    "uq_students_tenant_admission_number": "That admission number is already used in this school.",
    "uq_teachers_tenant_employee_id": "That employee ID is already used in this school.",
    "unique_class_identity": "This school already has a class for that grade and section this year.",
    "uq_user_roles_tenant_name": "A role with that name already exists.",
}


@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError):
    message = str(getattr(exc, "orig", exc))
    for constraint, detail in DUPLICATE_MESSAGES.items():
        if constraint in message:
            return JSONResponse(status_code=409, content={"detail": detail})
    return await debug_exception_handler(request, exc)


from src.core.exceptions.business import (
    BusinessLogicError, EntityNotFoundError, DuplicateEntityError, PermissionDeniedError
)

@app.exception_handler(BusinessLogicError)
async def business_logic_exception_handler(request, exc):
    from fastapi.responses import JSONResponse
    if isinstance(exc, EntityNotFoundError):
        status_code = 404
    elif isinstance(exc, DuplicateEntityError):
        status_code = 409
    elif isinstance(exc, PermissionDeniedError):
        status_code = 403
    else:
        status_code = 400
    return JSONResponse(
        status_code=status_code,
        content={"detail": str(exc)}
    )

# Add tenant middleware BEFORE other middlewares
app.middleware("http")(tenant_middleware)

# Set up CORS middleware
if settings.BACKEND_CORS_ORIGINS:
    print(f"CORS Origins: {settings.BACKEND_CORS_ORIGINS}")
    from fastapi.middleware.cors import CORSMiddleware

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.BACKEND_CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*", "X-Tenant-ID"],
    )

print("📢 API prefix:", settings.API_V1_STR)
# Include API router
app.include_router(api_router, prefix=settings.API_V1_STR)

# Static files and OpenAPI customization

# @app.get("/api/v1/super-admin/dashboard/recent-tenants")
# async def get_recent_tenants(limit: int = 5):
#     return [{"id": "1", "name": "Tenant 1", "domain": "example.com", "isActive": True, "createdAt": "2023-01-01", "updatedAt": "2023-01-01", "userCount": 10}]

# @app.get("/api/v1/super-admin/dashboard/tenant-stats")
# async def get_tenant_stats():
#     return {"total": 10, "active": 8, "inactive": 2, "newThisMonth": 1, "growthRate": 0.1}

# @app.get("/api/v1/super-admin/dashboard/user-stats")
# async def get_user_stats():
#     return {"total": 100, "active": 80, "inactive": 20, "avgPerTenant": 10, "recentLogins": 5}

# @app.get("/api/v1/super-admin/dashboard/system-metrics")
# async def get_system_metrics():
#     return {"cpuUsage": 0.5, "memoryUsage": 0.6, "diskUsage": 0.7, "activeConnections": 10, "alerts": [], "tenantGrowth": []}


@app.get("/health", include_in_schema=False)
def health() -> dict:
    """Liveness for deploy checks and monitors: the API answers and reaches the database."""
    from fastapi.responses import JSONResponse
    from sqlalchemy import text
    from src.db.session import platform_session

    db = platform_session()
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "ok"}
    except Exception:
        return JSONResponse(status_code=503, content={"status": "degraded", "database": "unreachable"})
    finally:
        db.close()


# Mount static files directory (create if doesn't exist for cloud deployment)
import os
os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

# Add this function to customize the OpenAPI schema
def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    
    openapi_schema = get_openapi(
        title=settings.PROJECT_NAME,
        version=settings.PROJECT_VERSION,
        description=settings.PROJECT_DESCRIPTION,
        routes=app.routes,
    )
    
    # Add global X-Tenant-ID parameter
    openapi_schema["components"]["parameters"] = {
        "X-Tenant-ID": {
            "name": "X-Tenant-ID",
            "in": "header",
            "required": True,
            "schema": {"title": "X-Tenant-ID", "type": "string", "format": "uuid"},
            "description": "Tenant ID (required for all endpoints)",
        }
    }
    
    for path_item in openapi_schema["paths"].values():
        for method in ("get", "put", "post", "delete", "options", "head", "patch"):
            op = path_item.get(method)
            if not isinstance(op, dict):
                continue
            op.setdefault("parameters", [])
            # Avoid duplicates
            if not any(
                isinstance(p, dict) and p.get("$ref") == "#/components/parameters/X-Tenant-ID"
                for p in op["parameters"]
            ):
                op["parameters"].append({"$ref": "#/components/parameters/X-Tenant-ID"})

    app.openapi_schema = openapi_schema
    return app.openapi_schema

# Override the default OpenAPI schema
app.openapi = custom_openapi

app.add_middleware(IdleActivityMiddleware)
app.add_middleware(AuditLoggingMiddleware)
