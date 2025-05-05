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
- [ ] Draw ER diagram for core entities: User, UserRole, Student, Teacher, Parent, Class, Section, Enrollment, Assignment, Grade, Subject, Notification
- [ ] Draw ER diagram for additional modules: ActivityLog, Admin, Announcement, Event, Exam, Feedback, Message, ParentPortal, Resource, Schedule, Timetable
- [x] Define base models with multi-tenant support:
  - [x] TenantMixin class with tenant_id foreign key
  - [x] UUIDMixin for UUID primary keys
  - [x] TimestampMixin for created_at/updated_at tracking
  - [x] TenantModel abstract base class
- [x] Define SQLAlchemy models in `src/db/models/` with tenant support
  - [x] Tenant, TenantSettings models
  - [x] User, UserRole, Permission models
  - [x] Admin model (polymorphic inheritance from User)
  - [ ] Student, Teacher, Parent models
  - [ ] Complete academic models: Grade, Section, Subject, Class_model, Enrollment, Assignment, Exam, Shedule, Timetable
  - [ ] Communication/admin models: Notification, Announcement, Event, Feedback, Message
  - [ ] logging/admin models: activity_Log model
  - [ ] resource/admin models: resource model
  
- [x] Configure `src/db/session.py` (connection pooling with tenant context)
- [x] Initialize Alembic (`alembic init alembic`)  
- [x] Configure `alembic.ini` & `env.py`  
- [x] Create & run initial migration, verify schema with tenant isolation

---

## 3. Core Module (`src/core/`)  
- [ ] Define Pydantic schemas (`schemas/`) for all models
- [ ] Define constants & enums (`constants/roles.py`, `constants/status_codes.py`)
- [ ] Define custom exceptions (`exceptions.py`)
- [ ] Implement tenant middleware (`middleware/tenant.py`)
- [ ] Implement tenant identification strategies (header, domain, subdomain)

---

## 4. Database CRUD Layer (`src/db/crud/`)  
- [ ] Implement base CRUD for non-tenant models
- [ ] Implement tenant-aware CRUD: `get_by_id()`, `list()`, `create()`, `update()`, `delete()` with mandatory tenant filtering  
- [ ] Add pagination (limit/offset), filtering helpers with tenant context
- [ ] Implement CRUD for the following models:
  - [ ] Tenant, TenantSettings
  - [ ] User, UserRole
  - [ ] Student, Teacher, Parent
  - [ ] Grade, Section, Subject
  - [ ] Class (linked to Grade, Section, Subject, Teacher)
  - [ ] Enrollment
  - [ ] Assignment
  - [ ] Notification
  - [ ] ActivityLog
  - [ ] Admin
  - [ ] Announcement
  - [ ] Event
  - [ ] Exam
  - [ ] Feedback
  - [ ] Message
  - [ ] ParentPortal
  - [ ] Resource
  - [ ] Schedule
  - [ ] Timetable
- [ ] Write unit tests for tenant-aware CRUD functions

---

## 5. Services Layer (`src/services/`)  
- [ ] Implement TenantBaseService with automatic tenant context injection
- [ ] Implement entity-specific services:
  - [ ] Enrollment service (enrollment rules)
  - [ ] Assignment service
  - [ ] Grade calculation service
  - [ ] Notification dispatch service
  - [ ] Audit and activity logging service
- [ ] Implement tenant settings service
- [ ] Inject CRUD dependencies into service classes  
- [ ] Manage transactions & rollback on errors  
- [ ] Write unit tests for tenant-isolated services

---

## 6. Authentication & Authorization (`src/core/security/`)  
- [ ] Implement JWT auth: token creation & verification, refresh tokens (with tenant claims)
- [ ] Password hashing with bcrypt  
- [x] Role-based access control using UserRole
- [x] Permission model for granular access control
- [ ] Tenant-aware permissions system (tenant admin, tenant user)
- [ ] OAuth provider integration (Google, Microsoft)
- [ ] FastAPI dependencies for permission enforcement with tenant context

---

## 15. Testing Strategy (`tests/`)  
- [x] Unit tests for:  
  - [x] Auth models (User, UserRole, Permission, Admin)
  - [x] Tenant models (Tenant, TenantSettings)
  - [ ] CRUD layer with tenant isolation
  - [ ] Services layer with tenant context
  - [ ] Auth utilities with tenant-specific permissions
- [ ] Integration tests for API endpoints (using `fastapi.testclient` or `httpx`) with tenant headers
- [x] Fixtures for test database (SQLite in-memory) with tenant data
- [ ] CI configuration to run tests on pull requests
- [ ] Test tenant isolation and data leakage prevention

# Note: If any of the above are not yet implemented, add a subtask or leave unchecked. If new features are needed, add them as new tasks.