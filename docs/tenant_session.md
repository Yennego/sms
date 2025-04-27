# Tenant-Aware Database Session

This document explains how the multi-tenant database session is implemented in the School Management System.

## Overview

The system uses a row-based multi-tenancy approach where all database tables have a `tenant_id` column. The database session is configured to automatically filter queries by the current tenant's ID, ensuring complete data isolation between tenants.

## Implementation Details

### 1. Context Variable for Tenant ID

A context variable is used to store the current tenant ID throughout the request lifecycle:

```python
tenant_context: ContextVar[Optional[str]] = ContextVar("tenant_id", default=None)
```

### 2. Tenant Middleware

The tenant middleware extracts the tenant ID from the request using multiple strategies:

- Header-based: Using the `X-Tenant-ID` header
- Domain-based: Using the request's domain or subdomain

Once identified, the tenant ID is stored in the context variable for use throughout the request.

### 3. Automatic Query Filtering

SQLAlchemy event listeners are used to automatically filter queries by tenant ID:

- `before_flush`: Ensures all new objects have the correct tenant_id
- `do_orm_execute`: Adds tenant_id filter to all queries

### 4. Connection Pooling

The database engine is configured with connection pooling for optimal performance:

- `pool_size`: Number of connections to keep open
- `max_overflow`: Maximum number of connections to create beyond pool_size
- `pool_timeout`: Seconds to wait before timing out on getting a connection
- `pool_recycle`: Seconds before a connection is recycled

## Usage

### Basic Usage

```python
from fastapi import Depends
from sqlalchemy.orm import Session

from src.db.session import get_db
from src.core.middleware.tenant import get_tenant_from_request

@app.get("/items/")
def read_items(
    tenant = Depends(get_tenant_from_request),
    db: Session = Depends(get_db)
):
    # Queries will be automatically filtered by tenant_id
    items = db.query(Item).all()
    return items
```

### Explicit Tenant Session

For cases where you need to explicitly specify the tenant ID:

```python
from src.db.session import get_tenant_db

@app.get("/items/{tenant_id}")
def read_tenant_items(
    tenant_id: str,
    db: Session = Depends(lambda: next(get_tenant_db(tenant_id)))
):
    # Queries will be filtered by the specified tenant_id
    items = db.query(Item).all()
    return items
```

## Best Practices

1. Always use the `get_tenant_from_request` dependency for tenant identification
2. Let the session handle tenant filtering automatically
3. Never manually filter by tenant_id in your queries
4. Use the `TenantModel` base class for all tenant-specific models
5. For super-admin operations that need to bypass tenant filtering, use a separate session without tenant context