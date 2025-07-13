from fastapi import FastAPI
# from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from fastapi.staticfiles import StaticFiles
from fastapi.openapi.utils import get_openapi 

from src.api.v1.api import api_router
from src.core.config import settings
# from src.db.init_db import init_db
# from src.db.session import SessionLocal
from src.core.logging import setup_logging
from src.core.middleware.audit_middleware import AuditLoggingMiddleware

setup_logging()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create database tables first
    # from src.db.models.base import Base
    # from src.db.session import engine
    # Base.metadata.create_all(bind=engine)
    
    # Then initialize data
    # db = SessionLocal()
    # init_db(db)
    # db.close()
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    description=settings.PROJECT_DESCRIPTION,
    version=settings.PROJECT_VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",      
    redoc_url="/redocs",   
    lifespan=lifespan,
    debug=True,
    redirect_slashes=False,      
)

# Set up CORS middleware
if settings.BACKEND_CORS_ORIGINS:
    print(f"CORS Origins: {settings.BACKEND_CORS_ORIGINS}")
    from fastapi.middleware.cors import CORSMiddleware

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000"],  # Your frontend URL
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*", "X-Tenant-ID"],  # Explicitly allow X-Tenant-ID header
    )

print("📢 API prefix:", settings.API_V1_STR)
# Include API router
app.include_router(api_router, prefix=settings.API_V1_STR)
for route in app.routes:
    print(f"🛣️ {route.path}")

@app.get("/")
def root():
    return {"message": "Welcome to the School Management System API"}

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


# Mount static files directory
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
            "schema": {
                "title": "X-Tenant-ID",
                "type": "string",
                "format": "uuid"
            },
            "description": "Tenant ID (required for all endpoints)"
        }
    }
    
    # Add the parameter to all paths
    for path in openapi_schema["paths"].values():
        for operation in path.values():
            if "parameters" not in operation:
                operation["parameters"] = []
            operation["parameters"].append({"$ref": "#/components/parameters/X-Tenant-ID"})
    
    app.openapi_schema = openapi_schema
    return app.openapi_schema

# Override the default OpenAPI schema
app.openapi = custom_openapi

@app.get("/test-cors")
async def test_cors():
    return {"message": "CORS is working!"}

# Add this after creating the FastAPI app
app.add_middleware(AuditLoggingMiddleware)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)