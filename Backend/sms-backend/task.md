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
  - [x] Student, Teacher, Parent models
  - [x] Complete academic models: Grade, Section, Subject, Class_model, Enrollment, Assignment, Exam, Schedule, Timetable
    - [x] Implemented polymorphic relationships between Grade, Assignment, and Exam models
  - [x] Communication/admin models: Notification, Announcement, Event, Feedback, Message
  - [x] logging/admin models: activity_Log model
  - [x] resource/admin models: resource model
  
- [x] Configure `src/db/session.py` (connection pooling with tenant context)
- [x] Initialize Alembic (`alembic init alembic`)  
- [x] Configure `alembic.ini` & `env.py`  
- [x] Create & run initial migration, verify schema with tenant isolation

---

## 3. Core Module (`src/core/`)  
- [x] Define Pydantic schemas (`schemas/`) for all models
- [x] Define constants & enums (`constants/roles.py`, `constants/status_codes.py`)
- [x] Define custom exceptions (`exceptions.py`)
- [x] Implement tenant middleware (`middleware/tenant.py`)
- [x] Implement tenant identification strategies (header, domain, subdomain)

---

## 4. Database CRUD Layer (`src/db/crud/`)  
- [x] Implement base CRUD for non-tenant models
- [x] Implement tenant-aware CRUD: `get_by_id()`, `list()`, `create()`, `update()`, `delete()` with mandatory tenant filtering
- [x] Add pagination (limit/offset), filtering helpers with tenant context
- [x] Implement CRUD for the following models:
  - [x] Tenant, TenantSettings
  - [x] User, UserRole
  - [x] Student, Teacher, Parent
  - [x] Grade, Section, Subject
  - [x] Class (linked to Grade, Section, Subject, Teacher)
  - [x] Enrollment
  - [x] Assignment
  - [x] Notification
  - [x] ActivityLog
  - [x] Admin
  - [x] Announcement
  - [x] Event
  - [x] Exam
  - [x] Feedback
  - [x] Message
  - [x] Resource
  - [x] Schedule
  - [x] Timetable
- [ ] Write unit tests for tenant-aware CRUD functions

---

## 5. Services Layer (`src/services/`)  
- [x] Implement TenantBaseService with automatic tenant context injection
- [x] Implement entity-specific services:
  - [x] Enrollment service (enrollment rules)
  - [x] Assignment service
  - [x] Grade calculation service
  - [x] Notification dispatch service
  - [x] Audit and activity logging service
  - [x] Class service
  - [x] Schedule service
  - [x] Timetable service
  - [x] Admin service
- [x] Implement tenant settings service
- [x] Inject CRUD dependencies into service classes
- [x] Manage transactions & rollback on errors
- [ ] Write unit tests for tenant-isolated services

---

## 6. Authentication & Authorization (`src/core/security/`)  
- [x] Implement JWT auth: token creation & verification, refresh tokens (with tenant claims)
- [x] Password hashing with bcrypt  
- [x] Role-based access control using UserRole
- [x] Permission model for granular access control
- [x] Tenant-aware permissions system (tenant admin, tenant user)
- [ ] OAuth provider integration (Google, Microsoft)
- [x] FastAPI dependencies for permission enforcement with tenant context

---

## 15. Testing Strategy (`tests/`)  
- [x] Unit tests for:  
  - [x] Auth models (User, UserRole, Permission, Admin)
  - [x] Tenant models (Tenant, TenantSettings)
  - [ ] CRUD layer with tenant isolation
  - [ ] Services layer with tenant context
  - [x] Auth utilities with tenant-specific permissions
- [ ] Integration tests for API endpoints (using `fastapi.testclient` or `httpx`) with tenant headers
- [x] Fixtures for test database (SQLite in-memory) with tenant data
- [ ] CI configuration to run tests on pull requests
- [ ] Test tenant isolation and data leakage prevention

# Note: If any of the above are not yet implemented, add a subtask or leave unchecked. If new features are needed, add them as new tasks.