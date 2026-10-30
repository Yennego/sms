# Technical requirements

## 1. Stack (kept)

| Layer | Choice |
|---|---|
| Backend | FastAPI 0.115, SQLAlchemy 2, Pydantic 2, Alembic, PostgreSQL 17, Redis (rate limits, token blacklist, idle timeout) |
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind, TanStack Query |
| Hosting | Railway: one web service per app, Postgres, Redis, a cron service; object storage (S3-compatible) for files |

No framework change is planned: the problems found are in structure and rules, not in the stack.

## 2. Architecture

```
Browser ──► Next.js (pages + /api route handlers = backend-for-frontend) ──► FastAPI ──► Postgres
                │ httpOnly session cookies                                    │      └► Redis
                └──────────────────────────────────────────────────────────── └► Object storage
```

- **Backend-for-frontend (BFF).** The browser talks only to Next.js. Next.js route handlers hold the tokens in httpOnly cookies and attach them to backend calls. Browser code never reads a token. (Today the access token is still script-readable; see §4.)
- **One proxy.** All backend calls go through one catch-all route (`/api/v1/[...path]`) with an allow-list of path prefixes. The ~60 hand-written per-endpoint proxy routes are removed.
- **Server-side guards.** Middleware checks for a session and redirects; role-gated layouts check roles on the server. Client components only render.

## 3. Tenant isolation

These are hard rules. Every pull request is reviewed against them, and the isolation test suite (§9) enforces them.

1. **The school comes from the session, never from the request.** For a normal user, the school is the one their account belongs to. An `X-Tenant-ID` header naming another school is rejected with 403. *(Done: `get_current_user` binds the request; `get_tenant_from_request` returns the bound school.)*
2. **Platform operators choose a school explicitly.** A super-admin acts on the school named in `X-Tenant-ID`; every such action is written to the platform audit log with the target school.
3. **Authenticated by default.** The API router requires a session for every route except a short `PUBLIC_ROUTES` list (login, refresh, logout, public school lookup). *(Done.)* A test fails the build if a route escapes this.
4. **Every query on school data filters by `tenant_id`.** This includes lookups by ID that come from the request (class, enrollment, teacher, subject, period). Lookups that follow a relation from an already-scoped row are fine.
5. **Database defence in depth.** PostgreSQL Row Level Security on every school table (43 tables): a row is visible only when its `tenant_id` matches the transaction setting `app.tenant_id`, set by `src/db/session.py` at the start of every transaction from the request's bound school. Platform sessions (`get_super_admin_db`, `platform_session()` for jobs) set `app.bypass_rls`. Not covered, with isolation kept in code: `tenants`, `users`/`students`/`teachers` (read at sign-in) and `activity_logs`. *(Done; takes effect only when the API connects as an ordinary role: `scripts/create_app_db_role.sql`.)*
6. **Composite foreign keys.** References between school tables are `(tenant_id, x_id) → (tenant_id, id)`, so the database rejects links across schools (95 constraints, prefix `fk_tn_`). "Who did it" columns (`marked_by`, `author_id`, ...) keep plain keys so an operator's actions inside a school can be recorded. School data refers to `tenants` with `ON DELETE RESTRICT`. *(Done.)*
7. **Shared catalogues are read-only to schools.** Roles and permissions are global today; only super-admins may change them. *(Done.)* The schema plan moves to system roles plus per-school custom roles.

## 4. Authentication and sessions

| Item | Rule | Status |
|---|---|---|
| Token types | Access (30 min) and refresh (30 days) JWTs, HS256; the `type` claim is checked wherever a token is used | Done |
| Signing key | `SECRET_KEY` required, at least 32 characters; startup fails otherwise | Done |
| Refresh | Rotates: the used refresh token is revoked; identity and super-admin status come from the database | Done |
| Logout | Revokes access and refresh tokens; clears every session cookie, including httpOnly ones | Done |
| Refresh cookie | httpOnly, `SameSite=Strict`, path `/api/auth`, `Secure` in production; never in a response body | Done |
| Access token | httpOnly cookie; the BFF catch-all proxy (`/api/v1/[...path]`) attaches it and refreshes on 401; browser code never reads a token | Done |
| Brute force | Per IP (30 per 15 min) and per account (lock after 5 failures for 15 min); Redis-backed | Done |
| Passwords | Argon2id; policy (length, classes) enforced on every admin-supplied password (user, student, teacher, parent, school admin); generated passwords always meet it | Done |
| First login | Server refuses everything except `GET /auth/me` and change-password while `is_first_login` is true (403 with `X-Password-Change-Required: 1`); the app redirects to the change-password page | Done |
| Generated passwords | Returned once to the creating admin (families often lack email); never logged | Accepted risk, documented |
| CSRF | BFF rejects state-changing requests whose `Origin` (or `Referer`) is not the app's own | Done |
| Idle timeout | 30 min of inactivity ends an access token | Exists |

## 5. Authorization

- Permissions, not role names, guard endpoints (`has_permission("manage_students")`). Role-name checks (`has_any_role(["admin"])`) are migrated to permissions.
- Super-admin status always comes from database roles, never from the token claim.
- Users can edit only profile fields on their own account; anything else needs `manage_users`. Super-admin accounts are invisible to schools. *(Done.)*
- Finance is staff-only: reads need `view_financial_data`, changes `manage_financial_data`. *(Done.)*
- Data-level rules (a sponsor sees their class, a parent sees linked children, a student sees themself) live in service functions with tests, as in `attendance_access.py`.

## 6. Configuration and secrets

- Secrets come only from the environment. `.env` files are never committed (`.env` and `.env.bak` were removed from tracking in Oct 2026; the values in git history must be treated as leaked and never reused).
- `DEBUG` defaults to off. API docs (`/docs`) are served only when `DEBUG=true`.
- 500 responses carry a generic message; details go to logs only.
- Required variables: `SECRET_KEY`, `DATABASE_URL` (the restricted `sms_app` login), `ALEMBIC_DATABASE_URL` (owner login, migrations only), `PROXY_SHARED_SECRET` (same value on backend and frontend: lets the frontend server pass on the visitor's address for per-IP rate limits), `REDIS_URL`, `ATTENDANCE_QR_SECRET`, `CORS_ORIGINS`, object storage credentials, SMTP credentials (SMS credentials only when SMS is switched on).

## 7. Data integrity

- **One unit of work per request.** Services stage changes and the request commits once; CRUD helpers stop committing on their own. Multi-step operations (create user and assign role, delete student and enrollments) succeed or fail as a whole.
- **Soft delete** (`deleted_at`) for students, staff, guardians and enrollments; hard delete only for records with no history.
- **No cascading delete from a school.** Removing a school is an explicit, audited purge job.
- **Derived values are calculated, not stored** (fee balances, attendance rates), or are recalculated by the same code path that changes their inputs.

## 8. Integrations

| Need | Plan |
|---|---|
| Files (excuse documents, photos, logos, resources) | S3-compatible object storage, keys prefixed by school id, signed URLs that expire. Move excuse documents out of Postgres. |
| Parent alerts | **Decided:** every alert goes to the in-app inbox; a copy goes by email when the family has an address, sent over SMTP with a free tier (for example Brevo's free daily allowance or the school's own mail account), so it costs nothing at school volumes. All channels sit behind one `MessageSender` interface with a delivery log. **SMS is on hold:** the interface has an SMS sender stub behind a setting, ready for a school's Android phone running the open-source textbee gateway (cost: the SIM bundle) or a paid provider (Africa's Talking, Twilio) sold to schools as credits. Remove `pywhatkit`, which drives WhatsApp Web and can't run on a server. WhatsApp Cloud API is free only for replies within 24 hours of a parent's message, so it isn't used for alerts. |
| Email | SMTP from environment variables; optional, since many families lack email. |
| Scheduled jobs | Railway cron: `python -m scripts.close_attendance_days` every 30 minutes; later, fee reminders and report generation. |

## 9. Testing and CI

- **Unit and service tests** on SQLite for business rules (pattern: `tests/attendance_fixtures.py`).
- **API tests** on the real app (pattern: `tests/test_security.py`): every route without a token returns 401; school A cannot reach school B; account-takeover paths are closed.
- **Isolation suite on PostgreSQL** once RLS lands, run in CI with a Postgres service.
- **Frontend:** type check and lint on every pull request; Playwright smoke tests for each role's main journey.
- **CI gates:** all tests green, no route outside `PUBLIC_ROUTES` without auth, migrations apply cleanly from empty and from the last release.

## 10. Non-functional targets

| Area | Target |
|---|---|
| Performance | Phone pages interactive within 3 s on 3G; API p95 under 500 ms for lists of 50 rows |
| Payload | Under 300 KB of JavaScript for scan, roster and parent pages |
| Availability | 99.5% during school hours |
| Backups | Daily, kept 30 days; restore drill each term (RPO 24 h, RTO 4 h) |
| Observability | Structured logs without personal data or tokens; Logfire traces; alerts on 5xx rate and failed cron runs |
| Privacy | Restricted fields (health, religion) need a specific permission; data export and deletion on request for a family |
| Accessibility | WCAG 2.1 AA basics |
| Browsers | Last two versions of Chrome, Edge, Safari, Firefox; Android Chrome on low-end phones |
