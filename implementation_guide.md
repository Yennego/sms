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

---

## 6. Attendance Module (`academics/attendance`)

**Status: Phase 1 (fixes) done 2026-10-24, see 6.2.1. Phase 2 (daily attendance) done 2026-10-26, see 6.3.6. Phases 3–4 not started.**

Goal: a student is marked present for a school day by scanning the QR code on their ID card. The manual flow stays: the class sponsor or an admin can mark or correct any student, and record an excuse.

Work is done in four phases. Phase 1 (fixes) must land first, because the manual flow and the QR flow share the same service code.

---

### 6.1 Current State

| Layer | File |
|---|---|
| Model | `src/db/models/academics/attendance.py` |
| Schemas | `src/schemas/academics/attendance.py` |
| CRUD | `src/db/crud/academics/attendance_crud.py` |
| Service | `src/services/academics/attendance_service.py` |
| API | `src/api/v1/endpoints/academics/attendance_api.py` (mounted under `/academics`) |
| Frontend services | `Frontend/sms-client/src/services/api/attendance-service.ts`, `enhanced-attendance-service.ts` |
| Frontend pages | `src/app/[tenantDomain]/attendance/*`, `teacher/attendance`, `student/attendance` |
| Frontend components | `src/components/attendance/*` (`DailyAttendanceGrid` is the admin marking grid) |

The current `attendances` table holds **one row per student, per class, per date**. Each row also needs a `schedule_id` or a `period`, so the model is period-based. There is no record of a "school day", no QR or ID-card code, no school calendar, and no field showing how a mark was made.

---

### 6.2 Phase 1: Fix Broken Behaviour

Each item lists the location, the symptom, and the fix.

#### Backend API: `attendance_api.py`

| # | Location | Symptom | Fix |
|---|---|---|---|
| B1 | `GET /attendance/report` | 500 error: calls `attendance_service.generate_report()`, which does not exist | Call `generate_attendance_report()` |
| B2 | `GET /attendance/absent`, `GET /attendance/late` | 500 error: passes `date=`, but the service expects `attendance_date=` | Pass `attendance_date=` |
| B3 | `GET /attendance/global-stats` | 500 error: calls `get_global_stats()`, which does not exist; the method is sync but is awaited. The role `"super_admin"` is not recognised (`has_any_role` checks `superadmin` / `super-admin`) | Call `get_global_attendance_stats()` without `await`; use role `"superadmin"` |
| B4 | `POST /attendance/mark-daily`, `PATCH /attendance/{id}/status` | Any error path becomes a 500: the parameter `status: AttendanceStatus` hides `fastapi.status`, so `status.HTTP_404_NOT_FOUND` raises `AttributeError` | Rename the parameter to `attendance_status` with `Query(..., alias="status")`, or import `from fastapi import status as http_status` |
| B5 | `POST /attendance/mark-daily` | `schedule_id` is required, which defeats the service's "schedule **or** period" fallback | Make `schedule_id: Optional[UUID] = None`; add `period: Optional[str] = None` and pass both through |
| B6 | Every endpoint with `except ValueError` | Service errors (`EntityNotFoundError`, `BusinessRuleViolationError`) fall through to the global handler. That handler returns 400 for every `BusinessLogicError`, even "not found" | Map `EntityNotFoundError` to 404 and `DuplicateEntityError` to 409 (extend the handler in `main.py`) |
| B7 | `GET /attendance?student_id=…` (role `student`) | A student can read **any** student's attendance; parents cannot read attendance at all | If the caller is a student, force `student_id = current_user.id`. Add the role `parent`, limited to their linked children |
| B8 | `SuperAdminAttendanceService.get_multi` | Uses `self.tenant_id`, which the super-admin service does not have | Add an optional `tenant_id` filter parameter instead |

#### Service and CRUD layer

| # | Location | Symptom | Fix |
|---|---|---|---|
| S1 | `attendance_crud.update_attendance_status` | Notes are **silently lost**: it writes key `comments`, but the column is `notes` (the base `update` skips unknown attributes) | Use `update_data['notes'] = comments` |
| S2 | Unique constraint `(student_id, class_id, date)` vs period marking | Marking period 2 overwrites period 1. The `GET` filtered by `schedule_id` then returns nothing for period 1 | Once the daily record exists (Phase 2), the period table is for subject periods only. Change the constraint to `(tenant_id, student_id, class_id, date, period_key)`, where `period_key = coalesce(schedule_id::text, period, 'day')`, and match the upsert lookup to it |
| S3 | Three different definitions of "present" | `is_present` counts present/late/tardy; `attendance_rate` counts present/late; `get_class_attendance_trends` and global stats count present/late. Excused and sick days **lower** the rate | Add one helper in the model module: `PRESENT_STATUSES = {PRESENT, LATE, TARDY}`, `EXCUSED_STATUSES = {EXCUSED, SICK}`. Rate = present / (total − excused). Use it everywhere |
| S4 | `bulk_mark_attendance` | Commits row by row, so a failure halfway leaves partial data. It recalculates every student's attendance grade over **all-time** records (not the academic year) on every save | Validate the class, year and permission once. Upsert all rows in one transaction (one `commit`). Move grade sync to `BackgroundTasks` and limit it to `academic_year_id` |
| S5 | `mark_daily_attendance` permission check | Checks `Section.class_teacher_id`, but `Class.class_teacher_id` is the sponsor according to the Class model docstring, and the two can disagree. If the user lookup returns `None`, the check **passes** | Check `cls.class_teacher_id == marked_by` (fall back to the section sponsor only if it is null). If the user is not found, deny |
| S6 | `mark_daily_attendance` | Does not check that the student is enrolled in the class (`Attendance.validate_student_enrollment` is a stub that returns `True`) | Query `ClassEnrollment` (`student_id`, `class_id`, `is_active`) and raise `BusinessRuleViolationError` if not enrolled. Delete the stub |
| S7 | `print(...)` in the bulk grade sync | Errors never reach the logs | Use `src.core.logging` |

#### Frontend

| # | Location | Symptom | Fix |
|---|---|---|---|
| F1 | `teacher/attendance/page.tsx:154` | **Save always fails.** It sends `section_id` as `class_id`, statuses in uppercase (`PRESENT`, while backend enum values are lowercase), and no `schedule_id`/`period` | Send the real `class_id` and lowercase statuses. After Phase 2, post to the daily endpoint, which needs no period |
| F2 | `teacher/attendance/page.tsx` | Lists the teacher's **subject assignments**, but the backend only lets the sponsor or an admin mark | List the classes where `class_teacher_id == me` (sponsor view). Subject teachers get read-only access, or period marking only |
| F3 | `teacher/attendance/page.tsx:151` | `new Date().toISOString()` gives the UTC date, which can be the wrong day for schools east of UTC | Omit `date` and let the server fill in "today" in the school's timezone (see 6.3.4) |
| F4 | `attendance-service.ts` `updateAttendanceStatus` | 405 error: sends `PUT`, but the backend route is `PATCH` | Use `client.patch` |
| F5 | `attendance-service.ts` `markDailyAttendance` | 422 error: never sends `class_id` | Add `class_id` to the type and the query |
| F6 | `app/api/v1/academics/attendance/class/[classId]/date/[attendance_date]/route.ts`, `…/enrolled-students/route.ts` | Proxy to backend endpoints that don't exist | Either add `GET /attendance/class/{class_id}/date/{date}` and `GET /attendance/class/{class_id}/enrolled-students` to the backend, or delete the proxies and their callers |
| F7 | `app/(dashboard)/attendance/{by-class,by-student,daily}/page.tsx` | Empty (0-byte) files | Delete them; the live pages are under `[tenantDomain]` |

**Phase 1 done when:** every endpoint in `attendance_api.py` returns a non-500 response for valid input (see the tests in 6.6), and a sponsor can save and re-open a class's attendance from the teacher page.

#### 6.2.1 Phase 1: What Was Done (and Where It Differs From the Plan Above)

All items above are implemented. Regression tests are in `tests/test_attendance.py` (18 tests, run with `python -m pytest tests/test_attendance.py`).

**Deploy step:** run the migration `alembic upgrade head` (revision `c3a7e1f2d9b4`). It replaces `unique_student_class_date_attendance` with the unique index `uq_attendance_student_class_date_period`.

Differences from the plan:

- **B6:** `main.py` now maps `EntityNotFoundError` to 404, `DuplicateEntityError` to 409 and `PermissionDeniedError` to 403 for **every** module, not only attendance. Other `BusinessLogicError`s stay 400.
- **B7:** implemented as `AttendanceService.resolve_viewable_student_id()`. Parents with several children must pass `student_id`.
- **S4:** the per-save grade sync (`sync_attendance_to_grade`) was **removed**, not moved to a background task. It had never worked: a `Grade` requires `subject_id` and `enrollment_id`, which a whole-day attendance record doesn't have. Attendance grades come from `sync_assessment_attendance`, which runs when an `ATTENDANCE` assessment is created. That path was also broken: `src/schemas/academics/grade.py` `GradeType` was missing `ATTENDANCE`. This is now fixed.
- **S5:** a non-sponsor now gets **403** (`PermissionDeniedError`). The same check also covers `PUT /attendance/{id}`, `PATCH /attendance/{id}/status` and `POST /attendance`. `POST /attendance` now ignores the client's `marked_by` and goes through the same validated path.
- **S6:** the enrollment check uses `Enrollment` (academic year + grade + section, `is_active`), **not** `ClassEnrollment`. This is the same lookup `GET /classes/{id}/students` uses to build the roster, so the list a sponsor sees and the check always agree.
- **S7:** resolved by removing the code that held the `print`.
- **F1/F2:** the teacher page now lists classes where the teacher is `class_teacher_id`, using the new `class_teacher_id` filter on `GET /academics/classes`. It loads today's saved marks and saves with `period="Daily"`. This interim "Daily" period is replaced by `DailyAttendance` in Phase 2.
- **F3:** the date is the **browser's local date** for now. The server-side school timezone comes with `AttendanceSettings` in Phase 2.
- **F6:** the special-purpose Next proxies were deleted (`bulk-mark`, `date/[date]`, `class/[classId]/*`). Requests now fall through to the generic `app/api/v1/[[...path]]` proxy and reach the backend directly. The old `bulk-mark` proxy called `mark-daily` once per student and returned 422 when the class had no timetable slot for that weekday.
- `mark-daily` takes `?date=` (what the frontend already sent) instead of `?attendance_date=`.

Found during Phase 1 but **not fixed** (pre-existing TypeScript errors, `tsc --noEmit`):

- `attendance/reports/page.tsx:49` calls `generateAttendanceReport` with 3 arguments, but it takes 1, so report filters are dropped.
- `attendance/students/page.tsx` and `attendance/students/[studentId]/page.tsx` have type mismatches (`studentId` property, paged response shape, `StudentAttendanceHistory` props).
- `enhanced-attendance-service.ts`: `bulkMarkAttendanceByClass` builds the wrong payload (an array, no period). It is unused. There are also several `Class`/`ClassAttendanceStats` type mismatches.

---

### 6.3 Phase 2: Daily (School-Day) Attendance and Settings

#### 6.3.1 New model: `DailyAttendance`

The source of truth for "was this student at school today". One row per student per school day. The existing `attendances` table stays, for subject or period attendance only.

```python
# src/db/models/academics/daily_attendance.py
class AttendanceSource(str, enum.Enum):
    QR = "qr"            # ID card scan
    MANUAL = "manual"    # sponsor/admin marked it
    AUTO = "auto"        # system marked absent at cut-off

class ExcuseStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"

class DailyAttendance(TenantModel):
    __tablename__ = "daily_attendances"

    student_id       = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    class_id         = Column(UUID(as_uuid=True), ForeignKey("classes.id"), nullable=False)   # homeroom at time of marking
    academic_year_id = Column(UUID(as_uuid=True), ForeignKey("academic_years.id"), nullable=False)
    date             = Column(Date, nullable=False, index=True)                                # school-local date
    status           = Column(Enum(AttendanceStatus), nullable=False)

    check_in_at      = Column(DateTime(timezone=True), nullable=True)   # first successful scan
    check_out_at     = Column(DateTime(timezone=True), nullable=True)
    source           = Column(Enum(AttendanceSource), nullable=False)
    marked_by        = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)  # null for AUTO
    marked_at        = Column(DateTime(timezone=True), nullable=False, default=func.now())

    # Excuse
    excuse_reason    = Column(Text, nullable=True)
    excuse_status    = Column(Enum(ExcuseStatus), nullable=True)
    excuse_document_url = Column(String(500), nullable=True)
    excuse_reviewed_by  = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    notes            = Column(Text, nullable=True)

    __table_args__ = (
        UniqueConstraint("tenant_id", "student_id", "date", name="uq_daily_attendance_student_date"),
        Index("idx_daily_att_tenant_class_date", "tenant_id", "class_id", "date"),
    )
```

#### 6.3.2 New model: `AttendanceEvent` (append-only audit log)

Every scan attempt (accepted, duplicate or rejected) and every manual change writes one row. It is never updated or deleted. Use it to answer "who changed this and when" and to debug scanner problems.

```python
class AttendanceEvent(TenantModel):
    __tablename__ = "attendance_events"
    daily_attendance_id = Column(UUID(as_uuid=True), ForeignKey("daily_attendances.id"), nullable=True)
    student_id   = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=True)  # null if token unreadable
    event_type   = Column(String(30), nullable=False)  # scan_accepted | scan_duplicate | scan_rejected | manual_set | excuse_set | excuse_reviewed | auto_absent
    old_status   = Column(String(20), nullable=True)
    new_status   = Column(String(20), nullable=True)
    actor_id     = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    device_label = Column(String(100), nullable=True)   # e.g. "Main gate tablet"
    reason       = Column(Text, nullable=True)          # rejection reason / manual note
    occurred_at  = Column(DateTime(timezone=True), nullable=False, default=func.now())
```

#### 6.3.3 Precedence rules

Both flows write to the same row, so these rules decide which write wins:

| Existing row | Incoming | Result |
|---|---|---|
| none | QR scan before `late_after` | `present`, `source=qr` |
| none | QR scan after `late_after` (before `scan_closes_at`) | `late`, `source=qr` |
| `qr` present/late | QR scan again | No change; respond `duplicate` (show "already checked in at 07:42") |
| `auto` absent | QR scan (student arrived after cut-off) | `late`, `source=qr` |
| `manual` excused/sick | QR scan | **No change**; the scan is logged only. Manual excuses are never overwritten by a scan |
| any | Manual mark by sponsor/admin | Manual value wins; `source=manual`; old/new values logged |
| any | Auto-absent job | Only creates rows for students with **no** row; never overwrites |

#### 6.3.4 Attendance settings (per tenant)

Store these under the `attendance` key in the existing `TenantSettings.settings` JSON. Validate them with a Pydantic schema, so no migration is needed:

```python
class AttendanceSettings(BaseModel):
    timezone: str = "Africa/Monrovia"           # school-local "today"
    school_days: list[int] = [0, 1, 2, 3, 4]    # Mon–Fri (date.weekday())
    late_after: time = time(8, 0)
    scan_closes_at: time = time(12, 0)          # scans rejected after this
    auto_absent_at: time = time(12, 0)          # unmarked students -> absent
    allow_checkout_scan: bool = False
```

Add a `SchoolCalendarDay` table (`tenant_id`, `date`, `is_school_day`, `label`) for holidays, exam breaks and make-up days. A day is a school day if: it is not marked `is_school_day=False`, **and** either its weekday is in `school_days` or it is marked `is_school_day=True`. The date must also fall within the active academic year.

Every "today" on the server must come from `school_today(tenant)`, which applies `timezone`. Never use `date.today()` or the UTC date.

#### 6.3.5 Daily API (manual flow)

All routes go under `/academics/attendance/daily`.

| Method & path | Roles | Purpose |
|---|---|---|
| `GET /daily?class_id=&date=` | admin, class sponsor | Class roster for the day: every actively enrolled student, joined to their daily row (or `status=null` if not yet marked) |
| `PUT /daily/{student_id}?date=` | admin, class sponsor | Set the status manually (`present/late/absent/excused/sick` + `notes`). Upserts the row and logs `manual_set` |
| `POST /daily/bulk` | admin, class sponsor | Save a whole roster in **one transaction** |
| `PUT /daily/{daily_id}/excuse` | admin, class sponsor | Record an excuse: `reason` (required), optional document upload. Sets status `excused` and `excuse_status=approved` (staff-entered excuses are pre-approved) |
| `POST /daily/{daily_id}/excuse/review` | admin | Approve or reject a `pending` excuse (for later parent-submitted excuses) |
| `GET /daily/student/{student_id}?from=&to=` | admin, sponsor, the student, their parent | History and summary |
| `POST /daily/close-day?date=` | admin | Run auto-absent now (manual trigger, see 6.4.4) |

Sponsor check (shared with Phase 1 fix S5): `Class.class_teacher_id == current_user.id`, using the class the student is actively enrolled in.

#### 6.3.6 Phase 2: What Was Done (and Where It Differs From the Plan Above)

All of 6.3 is implemented. The defaults in 6.8 were confirmed on 2026-10-26.

| Layer | File |
|---|---|
| Models | `src/db/models/academics/daily_attendance.py` (`DailyAttendance`, `AttendanceEvent`, `AttendanceSettings`, `SchoolCalendarDay`) |
| Migration | `alembic/versions/d5b2c8a41e07_daily_attendance.py` (applied to the local DB; Render applies it on deploy via `alembic upgrade head`) |
| Shared rules | `src/services/academics/attendance_access.py`: sponsor/admin check, enrollment check, who may view whose attendance, academic year for a date. Period attendance uses the same helpers. |
| Service | `src/services/academics/daily_attendance_service.py` |
| API | `src/api/v1/endpoints/academics/daily_attendance_api.py`. It is **mounted before** `attendance_api`, because `GET /attendance/{attendance_id}` would otherwise capture `/attendance/daily`, `/settings` and `/calendar`. A test guards this. |
| Tests | `tests/test_daily_attendance.py` (25 tests). The shared fixtures moved to `tests/attendance_fixtures.py`. |
| Frontend | `components/attendance/DailyRosterPanel.tsx` (shared roster), `teacher/attendance` (sponsor), `attendance/daily` (admin, with **Close day**), `settings/attendance` (rules + holidays), `services/api/daily-attendance-service.ts`, `types/daily-attendance.ts`. The sidebar's "Mark Attendance" now opens the daily page; the old period dashboard is under "Period Attendance". |

Differences from the plan:

- **Settings live in their own table** `attendance_settings`, not in `TenantSettings.settings["attendance"]`. The existing tenant-settings endpoints replace that JSON column wholesale, so saving any other school setting could silently erase the attendance rules.
- **Extra endpoints** beyond 6.3.5: `GET/PUT /attendance/settings`; `GET /attendance/calendar`, `PUT/DELETE /attendance/calendar/{date}` and `GET /attendance/calendar/day-info`; `GET /attendance/daily/{daily_id}/events` (audit trail, shown in the roster's history dialog).
- **Marking rules** that the plan didn't spell out:
  - `excused` requires `excuse_reason`.
  - `tardy` can't be set manually (it is kept for legacy records).
  - Future dates and non-school days are rejected.
  - Changing a student away from `excused` clears the excuse fields. The old values stay in the event log.
- **A day is a school day** only if it falls inside an academic year. A calendar override then wins over the weekly `school_days`.
- **Auto-absent (6.4.4 item 1) is already done**: the roster fills in missing students lazily, and `POST /attendance/daily/close-day` does the same for the whole school.
  - It never back-fills dates before the class's `start_date` or the academic-year start.
  - The Render cron job (6.4.4 item 2) is still Phase 3.
- **Concurrent saves:** if two people save the same student/day at once, the loser gets "changed by someone else… reload" (400). Other integrity errors are not hidden.
- **`attendance_rate` is `null`** in a student's daily summary when every record is excused or sick, instead of a misleading 0%.
- `tzdata` was added to `requirements.txt` and `pyproject.toml` (Windows has no system timezone database). `poetry.lock` was **not** regenerated.

Not done in Phase 2:

- No upload UI for excuse documents yet. The API accepts `excuse_document_url`.
- Parents can't submit excuses yet. The `pending` → review flow exists in the API.
- The student and parent attendance pages still read the period table. Switching them is Phase 4.
- Phase 1's interim teacher marks (period `"Daily"` rows in `attendances`) are not copied into `daily_attendances`. That is part of the Phase 4 data migration.

---

### 6.4 Phase 3: QR ID Cards and Scanning

#### 6.4.1 QR token format

The QR code holds a **signed token**, not the admission number. A photocopied or typed-in admission number cannot be used to check in, and a lost card can be revoked.

```
SMS1.<tenant_id_b64>.<student_id_b64>.<card_version>.<signature>
signature = base64url(HMAC_SHA256(ATTENDANCE_QR_SECRET, "SMS1.<tenant>.<student>.<version>"))[:22]
```

- `ATTENDANCE_QR_SECRET` is a new setting in `src/core/config.py` (env var). Do **not** reuse the JWT secret, so it can be rotated on its own.
- Add `card_version: int = 1` and `card_issued_at` to `Student`. **Reissuing** a card (lost or stolen) increments `card_version`; old cards then fail with `revoked`.
- Verification checks, in order: the prefix, the HMAC (constant-time `hmac.compare_digest`), that `tenant_id` matches the request tenant, that the student exists and `status == "active"`, and that `card_version` matches.
- Put this in `src/services/academics/qr_card_service.py` (`build_token`, `verify_token`).

#### 6.4.2 ID card generation

- Library: add `segno` to `pyproject.toml` / `requirements.txt` (pure Python, no Pillow needed for SVG).
- `GET /people/students/{id}/id-card/qr.svg` (admin): returns the QR as SVG.
- `POST /people/students/{id}/id-card/reissue` (admin): increments `card_version` and returns the new QR.
- Frontend: a printable ID card page `[tenantDomain]/students/[id]/id-card` and a bulk "print class cards" page. Show photo, name, admission number, class and the QR. Use CSS `@media print`, sized to CR80 (85.6 × 54 mm).

#### 6.4.3 Scan endpoint

`POST /academics/attendance/scan`

```json
// request
{ "token": "SMS1....", "mode": "check_in", "device_label": "Main gate tablet" }

// response 200
{
  "result": "accepted",            // accepted | duplicate | rejected
  "reason": null,                  // invalid_signature | wrong_tenant | revoked | inactive_student | not_school_day | scan_closed | not_enrolled
  "student": { "id": "...", "name": "...", "admission_number": "...", "photo": "...", "class_name": "Grade 5 - A" },
  "status": "present",
  "check_in_at": "2026-10-24T07:42:10+00:00"
}
```

- Roles: `admin` plus a new `attendance_scanner` role (gate staff or a kiosk account). Sponsors also have it, but **only** for students in their own class.
- Always return 200 with `result`/`reason` for scan outcomes, so the scanner UI can show them. Use 4xx only for auth or malformed requests.
- Rate-limit the endpoint per user (e.g. 120/min) and log every attempt as an `AttendanceEvent`.
- Concurrency: two scanners reading the same card at the same moment are handled by the unique constraint. Insert inside `try`; on `IntegrityError`, roll back, reload, and treat it as `duplicate`.

#### 6.4.4 Auto-absent at cut-off

There is no scheduler in the stack today, so add the job in two ways:

1. **Lazy (always works):** `GET /daily` for a past school day, or for today after `auto_absent_at`, first fills in missing rows as `absent`, `source=auto`.
2. **Scheduled:** a Render Cron Job (`render.yaml`) that calls `POST /academics/attendance/daily/close-day` for each active tenant, using a service token, every 15 minutes during school hours. The endpoint is idempotent.

Only students with an **active** `ClassEnrollment` in the current academic year get rows, and only on school days (6.3.4).

#### 6.4.5 Scanner UI

- Page: `[tenantDomain]/attendance/scan`. Camera scanning via `html5-qrcode` (pin an exact version in `package.json`).
- After each scan, show a large full-screen result with the student's photo and name. Green = accepted, amber = duplicate, red = rejected with the reason. Play a sound. Pause about 1.5 s before the next scan.
- Use a manual "type admission number" fallback when a card is damaged. It goes through the **manual** endpoint (logged as `manual_set`), not the scan endpoint.
- Offline queue (optional, later): store scans in IndexedDB with the device timestamp and send them when back online. The server keeps the earliest `check_in_at`.

---

### 6.5 Phase 4: Reporting and Integration

- Switch the student dashboard, the sponsor dashboard and `sync_attendance_to_grade` from `attendances` to `daily_attendances`, using the rate formula from S3, limited to the academic year.
- Admin dashboard tiles for today: scanned in / late / absent / excused / not yet marked, by class.
- Optional: notify the parent when a student is auto-marked absent (`src/services/notification/`).
- Data migration: copy existing `attendances` rows into `daily_attendances`, one per student per date. Pick the best status in this order: present > late > tardy > excused > sick > absent. Set `source=manual`.

---

### 6.6 Testing Checklist

Backend (`tests/`, pytest):

- [ ] Every Phase 1 bug item has a regression test (B1–B8, S1–S6)
- [ ] Scan: valid token → present; after `late_after` → late; second scan → duplicate; after `scan_closes_at` → rejected
- [ ] Scan: tampered signature, other tenant's card, old `card_version`, inactive student, non-school day → rejected with the correct reason
- [ ] Scan does not overwrite a manual `excused`; a manual mark overwrites a scan; every change writes an `AttendanceEvent`
- [ ] Two concurrent scans for one student → one row, one `accepted` + one `duplicate`
- [ ] Auto-absent only creates rows for unmarked, actively enrolled students on school days; running it twice creates nothing new
- [ ] "Today" is computed in the tenant's timezone (test with a timezone where UTC is on a different date)
- [ ] Sponsor of class A cannot mark or scan a student in class B; a student cannot read another student's attendance

Frontend: a sponsor can open the roster, mark, save, reload and see the saved values. The scanner shows all three result states.

---

### 6.7 Troubleshooting

| Symptom | Likely cause | Where to look |
|---|---|---|
| Teacher "Save Attendance" fails with 400 "Either schedule_id or period…" | Still posting to period bulk-mark without a period (F1) | `teacher/attendance/page.tsx`; should post to `/attendance/daily/bulk` |
| 403 "Only the section sponsor or an administrator…" | User is not `Class.class_teacher_id` for that class | Class settings → sponsor; S5 |
| Scan says `wrong_tenant` | Card printed for another school, or the scanner is logged into the wrong tenant | `X-Tenant-ID` header / tenant domain in the URL |
| Scan says `revoked` | Card was reissued; the student is using the old card | Print the current card |
| Scan says `invalid_signature` for every card | `ATTENDANCE_QR_SECRET` changed or differs between instances | Env vars on Render; all instances must share one secret |
| Students marked present on the wrong day / late wrongly | Tenant `timezone` or `late_after` not set correctly | `TenantSettings.settings["attendance"]` |
| Everyone absent on a holiday | Holiday missing from `SchoolCalendarDay` | Add the day, then re-mark (delete `auto` rows for that date) |
| Notes disappear after editing | S1 not applied (`comments` vs `notes`) | `attendance_crud.update_attendance_status` |
| Unhandled 500s | Global handler writes the stack trace to `tmp/backend_errors.log` | `main.py` `debug_exception_handler` |

### 6.8 Open Decisions (confirm before Phase 2/3)

These defaults are assumed above and are easy to change:

1. **Where scanning happens:** gate/kiosk staff (`attendance_scanner` role), plus sponsors for their own class.
2. **Late and cut-off times:** late after 08:00; scans close and auto-absent run at 12:00; timezone `Africa/Monrovia`.
3. **Excuses:** entered by sponsor/admin and pre-approved. Parent-submitted excuses (`pending` → admin review) are supported by the model but not built in v1.
4. **Check-out scanning:** off by default.
5. **Subject or period attendance:** kept as is (after the fixes) alongside daily attendance, rather than removed.
