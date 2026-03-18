---
name: saas_platform_evolution
description: Strategic guide for evolving the SMS Foundation into a feature-rich, multi-tenant SaaS platform.
---

# SMS SaaS Platform Evolution Skill

This skill provides a structured framework for implementing the four major phases of the SMS project roadmap: Monitoring, Revenue, Modularity, and AI Forecasting.

## 📁 System Architecture
When implementing changes, always adhere to the current project structure:
- **Frontend**: `Frontend/sms-client` (Next.js, TanStack Query, Tailwind CSS)
- **Backend**: `Backend/sms-backend` (FastAPI, SQLAlchemy, PostgreSQL)

## 🏗️ Core Principles
1. **Multi-Tenant Isolation**: Ensure all data queries and mutations use the `X-Tenant-ID` header and tenant-aware filters in the database.
2. **Modular Components**: Design UI and Backend modules to be "toggleable". Use feature flags linked to the tenant's subscription.
3. **Performance First**: Continue leveraging TanStack Query for caching and efficient data fetching in the Super-Admin panel.
4. **Data-Driven Insights**: Design schemas to capture high-resolution activity logs to power future AI forecasting.

## 🛠️ Phase Implementations

### Phase 1: Advanced Monitoring
- **Metrics**: Implement background aggregators for total users, active users, and storage per tenant.
- **UI**: Use charting libraries (e.g., Recharts) for growth visualization.
- **API**: Create specialized super-admin endpoints for system-wide statistics.

### Phase 2: Revenue & Billing
- **Subscription Schema**: Implement a `subscriptions` table linked to `tenants`.
- **Pricing Logic**: Define pricing tiers (Core, Pro, Enterprise) and "per-unit" charges.
- **Integration**: Prepare for Stripe or similar payment gateway integrations.

### Phase 3: Feature-Based Modularity
- **Feature Flags**: Implement a `tenant_features` table to store active modules per tenant.
- **Middleware/Guards**: Create backend middleware to block access to unauthorized modules based on the tenant's feature set.
- **UI Toggles**: Use a `useFeatures` hook in the frontend to conditionally render sidebar items and pages.

### Phase 4: AI & AI Forecasting
- **Data Collection**: Instrument the audit log system to collect usage patterns.
- **Model Integration**: Plan for Python-based analytical services (scikit-learn, statsmodels) to process system logs.
- **Insight Delivery**: Surfaces predictions (e.g., "Predicted 20% user growth next month") directly on the Super-Admin dashboard.

## 📝 Change Management
- Always update `implementation_plan.md` before starting a new phase.
- Use `walkthrough.md` to document the verification of each feature.
- Ensure all new API endpoints are documented in the backend OpenAPI spec.
