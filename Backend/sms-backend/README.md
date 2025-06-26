## Project Status

**The core module, CRUD layer, and service layer are fully implemented. The project is ready for advanced features such as RBAC, audit logging, file uploads, rate limiting, and more.**

---

# Multi-tenant School Management System

A production-grade School Management System built with Python, FastAPI, and PostgreSQL that follows clean architecture principles and supports multi-tenancy.

## Overview

This system allows multiple educational institutions (tenants) to manage their students, teachers, classes, and administrative tasks through a single platform while maintaining strict data isolation between tenants.

## Features

- **Core, CRUD, and Service Layers**: Fully implemented and production-ready
- **Multi-tenant Architecture**: Complete data isolation between different schools
- **Tenant Settings**: Flexible per-tenant configuration for branding, feature flags, and more
- **User Management**: Students, teachers, parents, and administrators
- **Role-Based Access Control (RBAC)**: Fine-grained permissions per tenant and user role (planned)
- **Academic Management**: Classes, sections, enrollments, assignments, and grades
- **Notifications**: Real-time updates via WebSockets
- **File Management**: Secure uploads for assignments, student photos, etc., with tenant isolation (planned)
- **Reporting**: Background processing for reports generation
- **Internationalization**: Multi-language support for global deployments
- **Audit Logging**: Complete tracking of all data changes per tenant (planned)
- **API Access**: Comprehensive REST API with rate limits and versioning
- **Rate Limiting & Caching**: Per-tenant quotas and cache isolation (planned)
- **Monitoring & Observability**: Per-tenant metrics, logging, and error tracking (planned)

## Roadmap / Planned Features

- [x] Core, CRUD, and service layers
- [ ] Tenant settings CRUD endpoints and service
- [ ] Role-based access control (RBAC) and permission dependencies
- [ ] Audit logging for all data changes
- [ ] File upload endpoints with tenant isolation
- [ ] Redis integration for caching and rate limiting per tenant
- [ ] Comprehensive unit and integration tests for tenant isolation
- [ ] Super-admin dashboard for tenant management
- [ ] Billing, subscription, and usage monitoring per tenant
- [ ] White-labeling and custom branding per tenant
- [ ] Advanced localization and i18n
- [ ] CI/CD, Docker, and production deployment scripts

## Tech Stack

- **Backend**: Python 3.11+ with FastAPI
- **Database**: PostgreSQL with SQLAlchemy ORM
- **Authentication**: JWT with OAuth provider integration
- **Caching**: Redis
- **Background Tasks**: Celery
- **Real-time**: WebSockets
- **Storage**: S3-compatible object storage
- **Monitoring**: Prometheus, Sentry

## Package Manager Recommendation

For this project, we recommend using **Poetry** for dependency management. Here's why:

1. **Deterministic Builds**: Poetry generates a `poetry.lock` file that guarantees the same dependencies are installed across environments
2. **Dependency Resolution**: Sophisticated dependency resolver to prevent conflicts
3. **Project Isolation**: Built-in support for virtual environments
4. **Build Management**: Seamless packaging and publishing
5. **Performance**: Significantly faster than pip for large dependency trees
6. **Developer Experience**: Clear, intuitive CLI and configuration

While alternatives exist, here's a comparison:

| Package Manager | Pros | Cons |
|----------------|------|------|
| **Poetry** (Recommended) | Deterministic, good dependency resolution, great UX | Slightly steeper learning curve |
| **pip + venv** | Simple, universal | Manual dependency resolution, no lock file by default |
| **Pipenv** | Lock file, virtual env management | Slower performance, less active development |
| **uv** | Extremely fast (Rust-based) | Newer, less mature ecosystem |

To use Poetry with this project:

```bash
# Install Poetry
curl -sSL https://install.python-poetry.org | python3 -

# Initialize project
cd school-management-system
poetry init

# Add dependencies
poetry add fastapi sqlalchemy pydantic alembic psycopg2-binary python-jose passlib python-multipart uvicorn

# Add dev dependencies
poetry add --group dev pytest pytest-cov black isort mypy

# Install dependencies
poetry install

# Activate the environment
poetry shell
```

## Project Structure

```
sms/ 
├── src/ 
│   ├── api/               # API endpoints
│   ├── core/              # Core functionality
│   │   ├── middleware/    # Middleware components
│   │   ├── i18n/          # Internationalization
│   │   └── security/      # Authentication & authorization
│   ├── db/                # Database
│   │   ├── crud/          # CRUD operations
│   │   └── models/        # SQLAlchemy models
│   ├── services/          # Business logic
│   ├── translations/      # Translation files
│   └── utils/             # Utility functions
├── alembic/               # Database migrations
├── models/                # Saved trained models
├── plots_visualization/   # Saved charts
├── scripts/               # Seeders, CLI tasks
├── tests/                 # Test suite
├── .env                   # Environment variables
├── .gitignore             # Git ignore file
├── pyproject.toml         # Poetry configuration
├── poetry.lock            # Poetry lock file
└── main.py                # Application entry point
```

## Getting Started

### Prerequisites

- Python 3.11+
- PostgreSQL 15+
- Redis 7+

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/school-management-system.git
   cd school-management-system
   ```

2. Install Poetry (if not already installed)
   ```bash
   curl -sSL https://install.python-poetry.org | python3 -
   ```

3. Install dependencies
   ```bash
   poetry install
   ```

4. Create and configure `.env` file
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

5. Apply database migrations
   ```bash
   poetry run alembic upgrade head
   ```

6. Run development server
   ```bash
   poetry run uvicorn main:app --reload
   ```

7. Access the API documentation at http://localhost:8000/api/v1/docs

### Creating a Tenant

1. Use the super-admin API to create a new tenant:
   ```bash
   curl -X POST "http://localhost:8000/api/v1/tenants" \
   -H "Content-Type: application/json" \
   -d '{"name": "Example School", "slug": "example-school", "domain": "example-school.yourdomain.com"}'
   ```

2. Once the tenant is created, you can access it via:
   - Custom domain: http://example-school.yourdomain.com
   - Header-based: Add `X-Tenant-ID: example-school` to your requests

## Integrating Claude Code

Claude Code can be integrated into this project to help with development tasks through the command line. Here's how to set it up:

### Installation

1. Ensure you have access to Claude Code (currently in research preview from Anthropic)
2. Install Claude Code according to Anthropic's documentation
3. Configure your Anthropic API key:
   ```bash
   export ANTHROPIC_API_KEY=your_api_key_here
   ```

### Usage with the Project

You can use Claude Code in several ways to enhance development:

1. **Project Directory Integration**:
   - You can use Claude Code from the project directory to get context-aware assistance
   - Create a `.claude` directory in your project root (this will be automatically .gitignore'd)
   ```bash
   mkdir .claude
   ```

2. **Code Generation**:
   - Generate boilerplate code for new features
   ```bash
   claude code "Create a FastAPI endpoint for creating a new teacher with tenant isolation"
   ```

3. **Code Explanation**:
   - Understand complex parts of the codebase
   ```bash
   claude code "Explain how the tenant middleware works in src/core/middleware/tenant.py"
   ```

4. **Bug Fixing**:
   - Get help with debugging issues
   ```bash
   claude code "Fix the tenant filtering in this CRUD function: [paste code]"
   ```

5. **Documentation**:
   - Generate documentation for your code
   ```bash
   claude code "Generate JSDoc style docstrings for all functions in src/services/enrollment.py"
   ```

### Best Practices with Claude Code

- Keep your prompts specific and contextual
- Use Claude Code for exploration and prototyping, then review the generated code
- For security, avoid sending sensitive credentials or data in prompts
- Remember that Claude Code may have limitations in understanding very complex project-specific logic

## Development Workflow

1. Create a feature branch
   ```bash
   git checkout -b feature/new-feature-name
   ```

2. Make your changes and write tests

3. Run tests
   ```bash
   poetry run pytest
   ```

4. Format code
   ```bash
   poetry run black .
   poetry run isort .
   ```

5. Run type checks
   ```bash
   poetry run mypy .
   ```

6. Submit a pull request

## Multi-tenancy Implementation

This project implements row-based multi-tenancy where:

- Each database table has a `tenant_id` column
- All queries automatically filter by the current tenant
- Middleware extracts tenant context from requests
- The API enforces strict tenant isolation
- Tenant settings are available for per-tenant customization

For detailed information, see the [Implementation Guide](implementation_guide.md).

## API Documentation

When the application is running, you can access:

- Swagger UI: http://localhost:8000/api/v1/docs
- ReDoc: http://localhost:8000/api/v1/redoc

## Testing

```bash
# Run all tests
poetry run pytest

# Run with coverage report
poetry run pytest --cov=src

# Run specific test module
poetry run pytest tests/api/test_teachers.py
```

## Deployment

### Docker

Build and run using Docker:

```bash
# Build image
docker build -t sms:latest .

# Run container
docker run -p 8000:8000 --env-file .env sms:latest
```

### Docker Compose

Deploy the full stack:

```bash
docker-compose up -d
```

### Production Deployment

For production, we recommend:

- AWS ECS with Fargate
- GCP Cloud Run
- Kubernetes with proper resource limits
- Database with read replicas for scaling

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- FastAPI for the excellent web framework
- SQLAlchemy for the powerful ORM
- Alembic for database migrations
- All other open-source projects that made this possible

## Tenant Settings

Each tenant can have custom settings stored as a flexible JSON object. Example:
```json
"settings": {
  "theme": "dark",
  "logo_url": "https://topfoundation.com/logo.png",
  "features": {
    "attendance": true,
    "grading": false
  },
  "max_students": 500
}
```
You can use the settings field to store branding, feature flags, quotas, and more. See the Implementation Guide for details.

## Core Module, CRUD, and Service Layers

The following foundational layers are implemented and production-ready:

- **Core Module**: Includes Pydantic schemas, constants/enums (roles, status codes), and custom exceptions for tenant-aware error handling. Tenant middleware supports header, domain, and subdomain identification.
- **CRUD Layer**: Base and tenant-aware CRUD operations are implemented, with pagination, filtering, and tenant management. All queries enforce tenant isolation.
- **Service Layer**: TenantBaseService and per-entity business logic (enrollment rules, grade calculations, notifications) are implemented with tenant context. Tenant settings service and transaction management are in place.

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

# src/db/crud/base.py
class TenantCRUDBase(Generic[TenantModelType]):
    ...
    def list(self, db: Session, tenant_id: Any, skip: int = 0, limit: int = 100, filters: Dict = {}):
        ...

# src/services/base.py
class TenantBaseService(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    ...
```

With these layers in place, the project is ready for advanced features such as RBAC, audit logging, file uploads, rate limiting, and more. See the Implementation Guide and Roadmap for next steps.