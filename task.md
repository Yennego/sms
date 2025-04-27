# tasks.md
A step-by-step guide to build a production-grade Multi-tenant School Management System (SMS) using Python, FastAPI, and PostgreSQL, following clean-architecture principles.
---
## 1. Project Initialization  
- [x] Create project folder structure
- [x] Initialize Git repo  
- [x] Create `.gitignore` (ignore `__pycache__/`, `.pytest_cache/`, `.venv/`, `.vscode/`, `.DS_Store`)  
- [x] Create & activate virtualenv, install dependencies  
- [x] Configure `.env` (DB URL, JWT secrets, rate-limit settings, tenant-specific settings, etc.)

---

## 2. Multi-tenant Database Design & Migrations  
- [x] Draw ER diagram for tenant entities: Tenant, TenantSettings
- [x] Draw ER diagram for core entities: User, Student, Teacher, Parent, Class, Section, Enrollment, Assignment, Grade, Notification (all with tenant relationship)
- [x] Define base models with multi-tenant support:
  - [x] TenantMixin class with tenant_id foreign key
  - [x] UUIDMixin for UUID primary keys
  - [x] TimestampMixin for created_at/updated_at tracking
  - [x] TenantModel abstract base class
- [x] Define SQLAlchemy models in `src/db/models/` with tenant support
- [x] Configure `src/db/session.py` (connection pooling with tenant context)
- [x] Initialize Alembic (`alembic init alembic`)  
- [x] Configure `alembic.ini` & `env.py`  
- [x] Create & run initial migration, verify schema with tenant isolation

---

## 3. Core Module (`src/core/`)  
- [x] Define Pydantic schemas (`schemas.py`) for requests & responses (with tenant context where needed)
- [x] Define constants & enums (`roles`, `status codes`) in `constants.py`
- [x] Define custom exceptions (`exceptions.py`) including tenant-specific exceptions
- [x] Implement tenant middleware (`middleware/tenant.py`)
- [x] Implement tenant identification strategies (header, domain, subdomain)

---

## 4. Database CRUD Layer (`src/db/crud/`)  
- [x] Implement base CRUD for non-tenant models
- [x] Implement tenant-aware CRUD: `get_by_id()`, `list()`, `create()`, `update()`, `delete()` with mandatory tenant filtering  
- [x] Add pagination (limit/offset), filtering helpers with tenant context
- [x] Implement tenant management CRUD operations
- [x] Write unit tests for tenant-aware CRUD functions

---

## 5. Services Layer (`src/services/`)  
- [x] Implement TenantBaseService with automatic tenant context injection
- [x] Implement tenant-specific business logic per entity:  
  - [x] Enrollment rules (max class size per tenant)  
  - [x] Grade calculations  
  - [x] Notification dispatch with tenant branding
- [x] Implement tenant settings service
- [x] Inject CRUD dependencies into service classes  
- [x] Manage transactions & rollback on errors  
- [x] Write unit tests for tenant-isolated services

---

## 6. Authentication & Authorization (`src/core/security/`)  
- [x] Implement JWT auth: token creation & verification, refresh tokens (with tenant claims)
- [x] Password hashing with bcrypt  
- [ ] Role-based access control (admin, teacher, student, parent)
- [ ] Tenant-aware permissions system (tenant admin, tenant user)
- [ ] OAuth provider integration (Google, Microsoft)
- [ ] FastAPI dependencies for permission enforcement with tenant context

---

## 7. API Routes & Controllers (`src/api/`)  
- [x] Design URI versioning: `/api/v1/...` (future `/api/v2/...`)  
- [x] Create tenant-aware routers for each resource:  
  - [x] **Auth**: `/api/v1/signup`, `/api/v1/login`, `/api/v1/refresh`  
  - [x] **Tenants**: CRUD endpoints (super-admin only)
  - [ ] **TenantSettings**: Configuration endpoints
  - [ ] **Students**, **Teachers**, **Parents**, **Classes**, **Sections**, **Enrollments**, **Assignments**, **Grades**, **Notifications** (all with tenant context)
- [x] Register routers in `main.py` under versioned prefix
- [x] Add tenant middleware to all routes

---

## 8. Utilities, Middleware & API Governance (`src/utils/`)  
- [ ] Logging middleware (request/response with tenant context)  
- [ ] Error-handling middleware (format exceptions)  
- [ ] CORS configuration per tenant
- [x] **Tenant Identification Middleware**:
  - [x] Header-based tenant identification (`X-Tenant-ID`)
  - [x] Domain-based tenant lookup
  - [x] Subdomain-based tenant routing
- [ ] **API Versioning**  
  - [x] Ensure all routers live under `/api/v{major}/...`  
  - [ ] Optionally support header versioning (`Accept: application/vnd.sms.v1+json`)  
- [ ] **Rate Limiting per Tenant**  
  - [ ] Integrate Redis-backed limiter (e.g. `fastapi-limiter`)  
  - [ ] Configure per-tenant quotas (e.g. Free plan: 60 req/min, Premium plan: 600 req/min)  
  - [ ] Return HTTP 429 with `Retry-After` header  
- [ ] **Usage Documentation**  
  - [x] Expose Swagger at `/api/v1/docs`, ReDoc at `/api/v1/redoc`  
  - [ ] Include examples, error codes  
- [ ] Write integration tests for tenant isolation and rate limits

---

## 9. File Storage and Uploads
- [ ] Implement tenant-isolated file storage
- [ ] Create file upload service with tenant context
- [ ] Add support for student photos, assignment submissions
- [ ] Implement file type validation and virus scanning
- [ ] Create endpoints for file uploads and downloads
- [ ] Configure S3 or other object storage with tenant prefixing

---

## 10. Caching Strategy
- [ ] Configure Redis connection
- [ ] Implement tenant-aware caching decorator
- [ ] Cache frequently accessed data (class schedules, user profiles)
- [ ] Set up cache invalidation on data changes
- [ ] Implement per-tenant cache limits and isolation

---

## 11. Batch Processing & Background Tasks
- [ ] Set up Celery for background processing
- [ ] Create task queue with tenant context
- [ ] Implement background report generation
- [ ] Add bulk import/export functionality
- [ ] Create scheduled tasks for tenant-specific operations

---

## 12. Audit Logging & Data History
- [ ] Implement audit log model with tenant context
- [ ] Create audit logging service
- [ ] Track create/update/delete operations
- [ ] Record user, timestamp, IP address, and changes
- [ ] Add audit log viewing endpoints

---

## 13. Localization & Internationalization
- [ ] Set up translation files system
- [ ] Implement tenant-specific locale settings
- [ ] Create i18n service for text translation
- [ ] Support multiple languages in UI and notifications
- [ ] Add locale detection from headers and preferences

---

## 14. WebSockets for Real-time Notifications
- [ ] Set up WebSocket connection manager with tenant isolation
- [ ] Implement real-time notification system
- [ ] Create connection handling with tenant context
- [ ] Add message broadcasting to tenant users
- [ ] Implement client reconnection handling

---

## 15. Testing Strategy (`tests/`)  
- [ ] Unit tests for:  
  - [ ] CRUD layer with tenant isolation
  - [ ] Services layer with tenant context
  - [ ] Auth utilities with tenant-specific permissions
- [ ] Integration tests for API endpoints (using `fastapi.testclient` or `httpx`) with tenant headers
- [ ] Fixtures for test database (SQLite in-memory) with tenant data
- [ ] CI configuration to run tests on pull requests
- [ ] Test tenant isolation and data leakage prevention

---

## 16. Documentation & API Specs  
- [ ] Ensure OpenAPI schemas are complete (models, examples) with tenant context
- [ ] Document environment setup in `README.md`
- [ ] Document multi-tenant architecture and configuration
- [ ] Create tenant onboarding guide
- [ ] Publish API spec (e.g. export YAML/JSON)

---

## 17. Tenant Administration
- [ ] Create super-admin interface for tenant management
- [ ] Implement tenant provisioning workflow
- [ ] Add tenant usage monitoring dashboard
- [ ] Create tenant configuration UI
- [ ] Implement tenant subscription and billing features

---

## 18. CI/CD & Deployment  
- [ ] GitHub Actions workflow: lint (flake8/isort), tests, build Docker image  
- [ ] Dockerize application (`Dockerfile`, `docker-compose.yml` for app + Postgres + Redis)  
- [ ] Deployment manifests or PaaS config (Heroku, AWS ECS/EKS, GCP Cloud Run)  
- [ ] Health-check & readiness endpoints with tenant status
- [ ] Database migration scripts with tenant safety checks

---

## 19. Monitoring & Observability
- [ ] Set up logging with tenant context
- [ ] Implement Prometheus metrics endpoint
- [ ] Create tenant-specific dashboards
- [ ] Configure alerts for tenant-specific issues
- [ ] Add error tracking with Sentry (tagged by tenant)

---

## 20. Bonus & Maintenance  
- [ ] Seed script for dummy data with tenant context (`scripts/seed.py`)
- [ ] CLI commands for tenant management tasks (using `typer` or `click`)
- [ ] Implement tenant data migration tools
- [ ] Create tenant backup and restore functionality
- [ ] Tenant white-labeling features (custom branding)
- [ ] Feature flag system for gradual feature rollout to tenants

# Note: If any of the above are not yet implemented, add a subtask or leave unchecked. If new features are needed, add them as new tasks.