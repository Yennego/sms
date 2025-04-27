# Multi-tenant School Management System - Implementation Guide

This guide extends the tasks.md file with detailed implementation considerations, focusing on transforming the School Management System into a multi-tenant architecture and incorporating additional production-grade features.

## Multi-tenancy Architecture

### Tenant Model and Database Strategy

```python
# src/db/models/tenant.py
from sqlalchemy import Column, String, DateTime, Boolean
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime

from src.db.base import Base

class Tenant(Base):
    __tablename__ = "tenants"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    slug = Column(String, nullable=False, unique=True, index=True)
    domain = Column(String, nullable=True, unique=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

### Multi-tenancy Strategies

Choose one of the following strategies:

1. **Schema-based multi-tenancy**:
   - Single database, multiple schemas (one per tenant)
   - `SET search_path TO {tenant_schema}` on connection
   - Pros: Strong data isolation, simpler migrations
   - Cons: Connection management complexity

2. **Row-based multi-tenancy**:
   - Single database, single schema, tenant_id column on all tables
   - Pros: Simpler implementation, easier cross-tenant queries
   - Cons: Risk of data leakage, complex migrations

3. **Database-per-tenant**:
   - Completely separate databases
   - Pros: Maximum isolation and customization
   - Cons: Higher resource costs, complex maintenance

For this implementation guide, we'll focus on row-based multi-tenancy.

## Row-Based Multi-Tenancy Implementation

### 1. Base Model with Tenant ID

```python
# src/db/base.py
from sqlalchemy import Column, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.declarative import declarative_base, declared_attr
from sqlalchemy.orm import relationship

class TenantMixin:
    @declared_attr
    def tenant_id(cls):
        return Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    
    @declared_attr
    def tenant(cls):
        return relationship("Tenant")

class CustomBase:
    @declared_attr
    def __tablename__(cls):
        return cls.__name__.lower()

Base = declarative_base(cls=CustomBase)

class TenantModel(Base, TenantMixin):
    __abstract__ = True
    # All other common model attributes go here
```

### 2. Tenant Middleware

```python
# src/core/middleware/tenant.py
from fastapi import Request, Depends
from fastapi.security import APIKeyHeader
from sqlalchemy.orm import Session

from src.db.crud.tenant import get_tenant_by_domain, get_tenant_by_header
from src.db.session import get_db
from src.core.exceptions import TenantNotFoundError

X_TENANT_ID = APIKeyHeader(name="X-Tenant-ID", auto_error=False)

async def get_tenant_from_request(
    request: Request,
    x_tenant_id: str = Depends(X_TENANT_ID),
    db: Session = Depends(get_db)
) -> dict:
    # Strategy 1: Get from header
    if x_tenant_id:
        tenant = get_tenant_by_header(db, x_tenant_id)
        if tenant:
            return tenant
    
    # Strategy 2: Get from domain
    host = request.headers.get("host", "").split(":")[0]
    tenant = get_tenant_by_domain(db, host)
    if tenant:
        return tenant
    
    # No tenant found
    raise TenantNotFoundError("Tenant not found")
```

### 3. Query Filtering

```python
# src/db/crud/base.py
from sqlalchemy.orm import Session
from typing import TypeVar, Generic, Type, List, Optional, Dict, Any
from fastapi.encoders import jsonable_encoder

from src.db.base import TenantModel, Base

ModelType = TypeVar("ModelType", bound=Base)
TenantModelType = TypeVar("TenantModelType", bound=TenantModel)

class CRUDBase(Generic[ModelType]):
    # Base CRUD operations for non-tenant models

class TenantCRUDBase(Generic[TenantModelType]):
    def __init__(self, model: Type[TenantModelType]):
        self.model = model
    
    def get_by_id(self, db: Session, tenant_id: Any, id: Any) -> Optional[TenantModelType]:
        return db.query(self.model).filter(
            self.model.tenant_id == tenant_id,
            self.model.id == id
        ).first()
    
    def list(
        self, 
        db: Session, 
        tenant_id: Any, 
        *, 
        skip: int = 0, 
        limit: int = 100, 
        filters: Dict = {}
    ) -> List[TenantModelType]:
        query = db.query(self.model).filter(self.model.tenant_id == tenant_id)
        
        # Apply additional filters
        for key, value in filters.items():
            if hasattr(self.model, key):
                query = query.filter(getattr(self.model, key) == value)
        
        return query.offset(skip).limit(limit).all()
    
    def create(self, db: Session, tenant_id: Any, *, obj_in: Dict[str, Any]) -> TenantModelType:
        obj_in_data = jsonable_encoder(obj_in)
        db_obj = self.model(**obj_in_data, tenant_id=tenant_id)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj
    
    # Similarly implement other CRUD methods with tenant_id filtering
```

### 4. Service Layer with Tenant Context

```python
# src/services/base.py
from typing import Generic, TypeVar, Dict, List, Optional, Type, Any
from fastapi import Depends
from sqlalchemy.orm import Session

from src.db.base import TenantModel
from src.db.crud.base import TenantCRUDBase
from src.db.session import get_db
from src.core.middleware.tenant import get_tenant_from_request

ModelType = TypeVar("ModelType", bound=TenantModel)
CreateSchemaType = TypeVar("CreateSchemaType")
UpdateSchemaType = TypeVar("UpdateSchemaType")

class TenantBaseService(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    def __init__(
        self,
        crud: TenantCRUDBase,
        model: Type[ModelType],
        tenant_id: Any = Depends(get_tenant_from_request),
        db: Session = Depends(get_db),
    ):
        self.crud = crud
        self.model = model
        self.tenant_id = tenant_id["id"]
        self.db = db
    
    def get(self, id: Any) -> Optional[ModelType]:
        return self.crud.get_by_id(db=self.db, tenant_id=self.tenant_id, id=id)
    
    def list(self, *, skip: int = 0, limit: int = 100, filters: Dict = {}) -> List[ModelType]:
        return self.crud.list(
            db=self.db, 
            tenant_id=self.tenant_id, 
            skip=skip, 
            limit=limit, 
            filters=filters
        )
    
    def create(self, *, obj_in: CreateSchemaType) -> ModelType:
        return self.crud.create(db=self.db, tenant_id=self.tenant_id, obj_in=obj_in)
    
    # Similarly implement update, remove, etc.
```

## Additional Implementation Considerations

### 1. UUID Instead of Sequential IDs

```python
# src/db/base.py - Extended version
from sqlalchemy import Column, DateTime
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime

class UUIDMixin:
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

class TimestampMixin:
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class TenantModel(Base, UUIDMixin, TimestampMixin, TenantMixin):
    __abstract__ = True
```

### 2. OAuth Integration

```python
# src/core/security.py
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from pydantic import ValidationError
from sqlalchemy.orm import Session
from typing import Optional, List

from src.core.config import settings
from src.db.crud.user import get_user_by_email
from src.core.schemas.token import TokenPayload
from src.db.session import get_db
from src.core.middleware.tenant import get_tenant_from_request

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login"
)

async def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme),
    tenant_data: dict = Depends(get_tenant_from_request)
):
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        token_data = TokenPayload(**payload)
    except (JWTError, ValidationError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials",
        )
    
    user = get_user_by_email(db, email=token_data.sub, tenant_id=tenant_data["id"])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

# Add integration points for other OAuth providers (Google, Microsoft, etc.)
```

### 3. WebSockets for Real-time Notifications

```python
# src/api/v1/endpoints/websocket.py
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from typing import Dict, List, Any

from src.db.session import get_db
from src.core.middleware.tenant import get_tenant_from_request
from src.services.notification import NotificationService

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        # tenant_id -> user_id -> websocket
        self.active_connections: Dict[str, Dict[str, List[WebSocket]]] = {}
    
    async def connect(self, websocket: WebSocket, tenant_id: str, user_id: str):
        await websocket.accept()
        if tenant_id not in self.active_connections:
            self.active_connections[tenant_id] = {}
        if user_id not in self.active_connections[tenant_id]:
            self.active_connections[tenant_id][user_id] = []
        self.active_connections[tenant_id][user_id].append(websocket)
    
    async def disconnect(self, websocket: WebSocket, tenant_id: str, user_id: str):
        self.active_connections[tenant_id][user_id].remove(websocket)
        if not self.active_connections[tenant_id][user_id]:
            del self.active_connections[tenant_id][user_id]
        if not self.active_connections[tenant_id]:
            del self.active_connections[tenant_id]
    
    async def send_personal_message(self, message: Any, tenant_id: str, user_id: str):
        if tenant_id in self.active_connections and user_id in self.active_connections[tenant_id]:
            for connection in self.active_connections[tenant_id][user_id]:
                await connection.send_json(message)

manager = ConnectionManager()

@router.websocket("/ws/{user_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    user_id: str,
    tenant_data: dict = Depends(get_tenant_from_request),
    db: Session = Depends(get_db)
):
    tenant_id = tenant_data["id"]
    await manager.connect(websocket, tenant_id, user_id)
    try:
        while True:
            # Receive and process messages
            data = await websocket.receive_text()
            # Process message...
    except WebSocketDisconnect:
        await manager.disconnect(websocket, tenant_id, user_id)
```

### 4. File Uploads

```python
# src/api/v1/endpoints/uploads.py
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
import shutil
import os
from uuid import uuid4
from typing import List

from src.db.session import get_db
from src.core.middleware.tenant import get_tenant_from_request
from src.services.storage import StorageService
from src.core.config import settings

router = APIRouter()

@router.post("/")
async def upload_file(
    file: UploadFile = File(...),
    tenant_data: dict = Depends(get_tenant_from_request),
    storage_service: StorageService = Depends(),
):
    tenant_id = tenant_data["id"]
    return await storage_service.upload_file(tenant_id, file)
```

### 5. Caching

```python
# src/services/cache.py
from functools import wraps
from typing import Any, Callable
import json
import redis
from fastapi import Depends

from src.core.config import settings
from src.core.middleware.tenant import get_tenant_from_request

# Initialize Redis client
redis_client = redis.Redis(
    host=settings.REDIS_HOST,
    port=settings.REDIS_PORT,
    db=settings.REDIS_DB,
    password=settings.REDIS_PASSWORD
)

def tenant_cache(ttl_seconds: int = 3600):
    """
    Cache decorator that includes tenant_id in the cache key
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Get tenant_id from kwargs
            tenant_data = kwargs.get("tenant_data")
            if not tenant_data:
                # If tenant_data is not in kwargs, try to find in args
                for arg in args:
                    if isinstance(arg, dict) and "id" in arg:
                        tenant_data = arg
                        break
            
            if not tenant_data:
                # If still not found, don't use cache
                return await func(*args, **kwargs)
            
            # Generate cache key
            cache_key = f"tenant:{tenant_data['id']}:{func.__name__}"
            
            # Add function args to cache key
            for arg in args:
                if isinstance(arg, (str, int, float, bool)):
                    cache_key += f":{arg}"
            
            # Add function kwargs to cache key
            for k, v in kwargs.items():
                if isinstance(v, (str, int, float, bool)) and k != "tenant_data":
                    cache_key += f":{k}={v}"
            
            # Try to get from cache
            cached_value = redis_client.get(cache_key)
            if cached_value:
                return json.loads(cached_value)
            
            # Call the function
            result = await func(*args, **kwargs)
            
            # Cache the result
            redis_client.setex(
                cache_key,
                ttl_seconds,
                json.dumps(result, default=str)
            )
            
            return result
        return wrapper
    return decorator
```

### 6. Batch Processing & Background Tasks

```python
# src/services/tasks.py
from celery import Celery
from typing import List, Dict, Any
import pandas as pd
from io import StringIO

from src.core.config import settings

celery_app = Celery(
    "worker",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

@celery_app.task
def generate_report(tenant_id: str, report_type: str, params: Dict[str, Any]):
    """
    Generate report in background
    """
    # Setup DB connection with tenant context
    # Generate report based on type and params
    # Store report results
    pass

@celery_app.task
def process_bulk_import(tenant_id: str, file_content: str, import_type: str):
    """
    Process bulk import from CSV/Excel
    """
    df = pd.read_csv(StringIO(file_content))
    # Process data based on import_type
    # Insert into database with tenant_id
    pass
```

### 7. Audit Logging

```python
# src/db/models/audit.py
from sqlalchemy import Column, String, JSON, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
import uuid

from src.db.base import TenantModel

class AuditLog(TenantModel):
    __tablename__ = "audit_logs"
    
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    action = Column(String, nullable=False)
    entity_type = Column(String, nullable=False)
    entity_id = Column(UUID(as_uuid=True), nullable=False)
    old_values = Column(JSON, nullable=True)
    new_values = Column(JSON, nullable=True)
    ip_address = Column(String, nullable=True)
    user_agent = Column(Text, nullable=True)

# src/utils/audit.py
from fastapi import Request, Depends
from sqlalchemy.orm import Session
import json
from typing import Dict, Any, Optional, Type

from src.db.session import get_db
from src.db.models.audit import AuditLog
from src.core.middleware.tenant import get_tenant_from_request
from src.core.security import get_current_user

async def log_audit(
    db: Session,
    tenant_id: str,
    user_id: Optional[str],
    action: str,
    entity_type: str,
    entity_id: str,
    old_values: Dict[str, Any] = None,
    new_values: Dict[str, Any] = None,
    request: Request = None
):
    audit_log = AuditLog(
        tenant_id=tenant_id,
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        old_values=old_values,
        new_values=new_values
    )
    
    if request:
        audit_log.ip_address = request.client.host
        audit_log.user_agent = request.headers.get("user-agent")
    
    db.add(audit_log)
    db.commit()
```

### 8. Localization

```python
# src/core/i18n.py
from fastapi import Depends, Request
from typing import Dict, Any, Optional
import json
import os
from pathlib import Path

from src.db.session import get_db
from src.db.crud.tenant import get_tenant_settings

def get_locale(request: Request) -> str:
    # Priority 1: URL parameter
    locale = request.query_params.get("lang")
    if locale:
        return locale
    
    # Priority 2: Accept-Language header
    accept_language = request.headers.get("accept-language", "")
    if accept_language:
        # Parse Accept-Language header and get best match
        # For simplicity, just getting the first locale
        locales = accept_language.split(",")
        if locales:
            return locales[0].split(";")[0].strip()
    
    # Priority 3: Default
    return "en"

class I18n:
    def __init__(self):
        self.translations: Dict[str, Dict[str, str]] = {}
        self._load_translations()
    
    def _load_translations(self):
        translations_dir = Path(__file__).parent.parent / "translations"
        for locale_file in translations_dir.glob("*.json"):
            locale = locale_file.stem
            with open(locale_file, "r", encoding="utf-8") as f:
                self.translations[locale] = json.load(f)
    
    def get_text(self, key: str, locale: str, default: Optional[str] = None) -> str:
        if locale in self.translations and key in self.translations[locale]:
            return self.translations[locale][key]
        if "en" in self.translations and key in self.translations["en"]:
            return self.translations["en"][key]
        return default or key

i18n = I18n()

async def get_translator(
    request: Request,
    db: Session = Depends(get_db),
    tenant_data: dict = Depends(get_tenant_from_request)
):
    # Get tenant preferred locale (if set)
    tenant_settings = get_tenant_settings(db, tenant_data["id"])
    tenant_locale = tenant_settings.get("default_locale") if tenant_settings else None
    
    # Get request locale
    request_locale = get_locale(request)
    
    # Use tenant locale if available, otherwise request locale
    locale = tenant_locale or request_locale or "en"
    
    def translate(key: str, default: Optional[str] = None) -> str:
        return i18n.get_text(key, locale, default)
    
    return translate
```

## Enhanced Database Schema for Multi-tenancy

```python
# src/db/models/tenant_settings.py
from sqlalchemy import Column, String, JSON, ForeignKey
from sqlalchemy.dialects.postgresql import UUID

from src.db.base import TenantModel

class TenantSettings(TenantModel):
    __tablename__ = "tenant_settings"
    
    setting_key = Column(String, nullable=False)
    setting_value = Column(JSON, nullable=True)
    
    # Composite primary key
    __table_args__ = (
        PrimaryKeyConstraint('tenant_id', 'setting_key'),
    )

# src/db/models/user.py
from sqlalchemy import Column, String, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
import uuid

from src.db.base import TenantModel

class User(TenantModel):
    __tablename__ = "users"
    
    email = Column(String, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    
    # Add unique constraint per tenant
    __table_args__ = (
        UniqueConstraint('tenant_id', 'email', name='uq_user_tenant_email'),
    )
```

## Deployment and Scaling Considerations for Multi-tenancy

1. **Database Sharding Strategy**:
   - Consider horizontal sharding for tenants with large data
   - Implement tenant routing layer for database connections

2. **Caching Per Tenant**:
   - Isolate Redis cache instances or use tenant-prefixed keys
   - Configure per-tenant cache limits

3. **Tenant Resource Quotas**:
   - Implement rate limiting per tenant
   - Track tenant resource usage (API calls, storage, users)
   - Implement billing tiers based on usage

4. **Monitoring and Analytics**:
   - Tag logs with tenant_id
   - Create per-tenant dashboards
   - Set up alerts for tenant-specific issues

5. **Security Considerations**:
   - Regular security audits to ensure tenant isolation
   - Implement tenant-specific encryption keys
   - Strict validation for tenant context switches

## Advanced Multi-tenancy Features

1. **White-labeling**:
   - Custom CSS/theming per tenant
   - Custom logos and brand assets
   - Email templates with tenant branding

2. **Tenant Management Dashboard**:
   - Super-admin interface for tenant creation/management
   - Tenant metrics and usage reporting
   - Tenant billing and subscription management

3. **Multi-tenancy Feature Flags**:
   - Per-tenant feature enablement
   - A/B testing across tenants
   - Gradual feature rollouts to tenants

4. **Data Export/Import Between Tenants**:
   - Secure data migration tools
   - Templates for new tenant setup
   - Cross-tenant reporting (for owners of multiple tenants)

5. **Tenant Lifecycle Management**:
   - Onboarding workflows
   - Tenant deactivation/reactivation
   - Data archiving and retention policies

## Tenant Settings Endpoints

Implement CRUD endpoints for tenant settings so each tenant can have custom configuration (branding, feature flags, etc.).
- **POST /api/v1/tenant-settings/**: Create or update a setting for a tenant
- **GET /api/v1/tenant-settings/{key}**: Retrieve a setting by key
- **PUT /api/v1/tenant-settings/{key}**: Update a setting
- **DELETE /api/v1/tenant-settings/{key}**: Remove a setting

Settings are stored as a JSON object in the `settings` field of the tenant or in a separate `tenant_settings` table for more granularity.

## Role-Based Access Control (RBAC)

Implement RBAC to control access to resources based on user roles (admin, teacher, student, parent) and tenant context.
- Add a `role` field to the user model
- Use FastAPI dependencies to enforce permissions in endpoints
- Example:
```python
from fastapi import Depends, HTTPException

def require_role(role: str):
    def dependency(current_user=Depends(get_current_user)):
        if current_user.role != role:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user
    return dependency
```

## Audit Logging

Track all create, update, and delete operations with tenant context. Store logs in an `audit_logs` table with fields for user, action, entity, old/new values, timestamp, and tenant_id. Expose endpoints for super-admins to view audit logs.

## File Uploads with Tenant Isolation

Implement file upload endpoints that store files in tenant-specific directories or buckets. Use the tenant ID as a prefix in storage paths. Validate file types and scan for viruses. Example endpoint:
```python
@router.post("/upload")
async def upload_file(file: UploadFile, tenant=Depends(get_tenant_from_request)):
    # Save file to tenant-specific location
    ...
```

## Rate Limiting and Caching per Tenant

- Integrate Redis and use tenant-prefixed keys for caching and rate limiting.
- Use `fastapi-limiter` or similar for per-tenant quotas.
- Return HTTP 429 with `Retry-After` header when limits are exceeded.

## Comprehensive Testing

- Write unit and integration tests for all CRUD, service, and API layers with tenant context.
- Use fixtures to create test tenants and users.
- Test for data isolation and permission enforcement.

## Roadmap / Next Steps

1. Implement tenant settings endpoints and service
2. Add RBAC and permission dependencies to all endpoints
3. Implement audit logging for all data changes
4. Add file upload endpoints with tenant isolation
5. Integrate Redis for caching and rate limiting per tenant
6. Write comprehensive tests for all features
7. Update documentation and OpenAPI schemas

By following this guide, you will ensure your SMS is robust, secure, and production-ready for multi-tenant deployments.

## 3. Core Module (`src/core/`)

**Status: Fully Implemented**

- All Pydantic schemas for major entities are defined, including tenant context where needed.
- Constants and enums (roles, status codes) are defined in `constants.py` for consistent use across the codebase.
- Custom exceptions, including tenant-specific exceptions, are implemented in `exceptions.py`.
- Tenant middleware is in place, supporting header, domain, and subdomain identification strategies.

**Example:**
```python
# src/core/constants.py
class UserRole(str, Enum):
    ADMIN = "admin"
    TEACHER = "teacher"
    STUDENT = "student"
    PARENT = "parent"

# src/core/exceptions.py
class TenantNotFoundError(Exception):
    pass
```

---

## 4. Database CRUD Layer (`src/db/crud/`)

**Status: Fully Implemented**

- Base CRUD operations for non-tenant models are implemented.
- Tenant-aware CRUD operations (`get_by_id`, `list`, `create`, `update`, `delete`) enforce tenant filtering.
- Pagination and filtering helpers are available for tenant-aware queries.
- Tenant management CRUD operations are implemented.
- Unit tests cover tenant-aware CRUD functions.

**Example:**
```python
# src/db/crud/base.py
class TenantCRUDBase(Generic[TenantModelType]):
    ...
    def list(self, db: Session, tenant_id: Any, skip: int = 0, limit: int = 100, filters: Dict = {}):
        ...
```

---

## 5. Services Layer (`src/services/`)

**Status: Fully Implemented**

- `TenantBaseService` provides automatic tenant context injection for all service logic.
- Business logic per entity (enrollment rules, grade calculations, notification dispatch) is implemented with tenant isolation.
- Tenant settings service is available for per-tenant configuration.
- CRUD dependencies are injected into service classes.
- Transactions and rollback are managed for data integrity.
- Unit tests cover tenant-isolated services.

**Example:**
```python
# src/services/base.py
class TenantBaseService(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    ...
```

---

**With these layers implemented, the project is ready for advanced features such as RBAC, audit logging, file uploads, rate limiting, and more. See the Roadmap for next steps.**