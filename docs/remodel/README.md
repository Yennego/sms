# Remodel: document set

These documents define the remodel of the School Management System (SMS). They are written from the October 2026 code review (security, data isolation, app flow, existing docs and schema) and from the attendance work already shipped.

| # | Document | Answers |
|---|---|---|
| 1 | [PRD](01-prd.md) | Who it is for, what problems it solves, what is in scope, how we measure success |
| 2 | [Technical requirements](02-technical-requirements.md) | Architecture, security and isolation rules, non-functional targets, hosting |
| 3 | [App flow](03-app-flow.md) | URL scheme, navigation per role, the key journeys screen by screen |
| 4 | [Design brief](04-design-brief.md) | Design principles, design system, layout, mobile and low-bandwidth rules |
| 5 | [Schema plan](05-schema-plan.md) | Database changes, in migration order |
| 6 | [Implementation plan](06-implementation-plan.md) | Phases, exit criteria, testing, what is already done |

## Status of older documents

- `implementation_guide.md` section 6 (Attendance) stays the reference for the attendance module. Its earlier sections are generic advice and are superseded by these documents.
- `task.md`, `README.md` (root and backend), `Frontend/sms-client/frontend_tasks.md`, `frontend_task.pdf` and `domainUrl.md` are stale and should be archived or rewritten after the remodel starts.
- `docs/tenant_session.md` describes automatic tenant filtering that does not exist. Do not rely on it; see [Technical requirements §3](02-technical-requirements.md#3-tenant-isolation).
- `docs/business_rules/*.md` remain valid inputs, with the differences noted in the [schema plan](05-schema-plan.md).

## Decisions

Made (Oct 2026):

1. **Logins:** one account per school. A parent with children in two schools has two logins ([schema plan §2](05-schema-plan.md#2-tenant-integrity)).
2. **Pricing:** a fee per user, not per student ([PRD §8](01-prd.md#8-commercial-model)).
3. **Parent alerts:** in-app for every alert, plus free email where the family has one. SMS is on hold: the sending layer is built so it (school Android phone, or a paid provider sold as credits) can be switched on later ([technical requirements §8](02-technical-requirements.md#8-integrations)).
4. **Currency:** USD and LRD. A student's first payment in a school year sets the currency for all their remaining installments that year ([schema plan §7](05-schema-plan.md#7-finance)).
5. **Billing:** per term (semester); staff billed while active, parents and students in months they sign in; read-only at 30 days overdue, suspended at 60 ([PRD §8](01-prd.md#8-commercial-model)).

Still open: prices, set after the pilot.

## Phase 1 decisions

1. **Database login for the API:** the API connects as `sms_app` (no superuser, no row level security bypass), created with `scripts/create_app_db_role.sql`; migrations use the owner login in `ALEMBIC_DATABASE_URL`. Done locally; repeat on each new database.
2. **Migration history:** replaced by one baseline migration that builds a database from empty. Done.
3. **Sign-in identifier:** email or username, unique per school; phone numbers aren't used to sign in because families share phones. Username comes with Phase 3.
4. **Frontend instances:** one frontend server serves every school at once, so many schools signing in together is fine. Only running several copies of the frontend server (for load or zero-downtime deploys) would need the token refresh shared through Redis; until then, one instance.
5. **Forgot password, register, reset password:** fixed. Reset by email per school (`/{school}/forgot-password`, single-use link valid 30 minutes, needs Redis); families without email ask the school office. Self-registration was removed: accounts are created by the school.
