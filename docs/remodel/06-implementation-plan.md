# Implementation plan

Phases run in order; each ends with its exit criteria met and the full test suite green. Phase sizes assume one full-stack developer with AI assistance; adjust after Phase 1.

## Phase 0: Security hotfix (done, Oct 2026)

What changed:

| Area | Change |
|---|---|
| Authenticated by default | `api_router` runs `authenticate_request` on every route; only `PUBLIC_ROUTES` (login, refresh, logout, public school lookup) are open. Scan before: 72 unguarded routes; after: 0. |
| Tenant binding | `get_current_user` binds each request to the user's own school (403 if `X-Tenant-ID` names another); super-admins (by database role) choose a school via the header; `get_tenant_from_request` returns the bound school to every service. |
| Tokens | `verify_token` checks the `type` claim; refresh rotates and revokes the used token and takes identity from the database; logout revokes access and refresh tokens. |
| Schools | Create, list, update (billing), delete: super-admin only; school admins edit branding only (`PUT /tenants/self`); settings and notification config limited to the caller's own school; public lookups return branding only. |
| Users | No password changes via `PUT /users/{id}`; self-edit limited to profile fields; editing others needs `manage_users`; super-admins invisible to schools; delete needs `delete_users`. |
| Roles and permissions | Create role, set role permissions, create/update/delete permission: super-admin only (they are shared by every school). |
| People | Teacher and parent create/update/delete guarded by permissions; student delete checks school ownership before touching enrollments and commits once. |
| Finance | Reads need `view_financial_data`, changes `manage_financial_data` (any student could edit fees before). |
| Super-admin dashboard | Router-level super-admin check. |
| Cross-school lookups | 15 ID lookups taken from requests now filter by school (grading, timetable, teacher assignment, grade calculation, notifications, assessments, exams, assignments). |
| Login throttling | Was silently disabled (its own error was swallowed); now per IP and per account with lockout. |
| Config | `SECRET_KEY` required (≥ 32 chars); `DEBUG` off by default; docs only in debug; generic 500 body; `.env` and `.env.bak` removed from git tracking. |
| Frontend | Refresh and logout routes read the httpOnly refresh cookie server-side; refresh token never in a response body; cookie path `/api/auth`; `Secure` only in production; "superadmin" email rule removed; tokens no longer logged; scanner menu fixed. |
| Tests | `tests/test_security.py` (12 tests): every non-public route returns 401 without a token, refresh tokens rejected as access tokens, header can't switch school, cross-school user access, takeover paths, finance and platform access. Full suite: 93 passing. |

Still open from the review (carried into Phase 1): RLS, composite FKs and per-school uniques; access token in an httpOnly cookie (BFF); CSRF origin check; password policy on create/reset; server-enforced first-login change; redaction of 9 stored audit rows; purge `.env` from git history and never reuse those secrets; add `httpx` to `pyproject.toml` dev dependencies and relock.

**To verify by hand before merging:** sign in as a school admin, a teacher, a parent and the super-admin; reload after 30+ minutes (token refresh); sign out and confirm the session is gone.

## Phase 1: Foundation (2–3 weeks)

Goal: the platform is safe by construction and the codebase is clean enough to rebuild on.

**Status (Oct 2026): built, not yet merged.** Schema plan steps 1–4 (in the baseline migration), RLS with the API on the `sms_app` login, unit of work, BFF session, first-login and password policy, cleanup and CI are in place; 104 backend tests pass plus 5 PostgreSQL isolation tests. Still open: create `sms_app` on each other database, and username sign-in (moved to Phase 3).

- Schema plan steps 1–4: per-school uniques, `users.tenant_id` NOT NULL, composite FKs, RLS with a bypass role for platform work, system vs custom roles.
- BFF session: access token in an httpOnly cookie; one catch-all proxy with a path allow-list; delete the ~60 per-endpoint proxy routes; one `getSession()` used by middleware and layouts; server-side role guards; CSRF origin check.
- First-login enforcement and password policy on every create/reset.
- One unit of work per request (CRUD stops committing).
- Repository cleanup: delete the stale root `src/`, `tests/`, `alembic.ini`, `poetry.lock` copy; delete `(dashboard)/` and empty pages; archive stale docs.
- CI: backend tests (SQLite and a Postgres isolation job), frontend type check and lint, route-auth check.

Exit: isolation suite passes on Postgres with RLS on; no Bearer tokens in browser code; CI green on every pull request.

## Phase 2: App shell and navigation (1–2 weeks)

**Status (Oct 2026): built, not yet merged.** One navigation config (`src/config/navigation.ts`) drives the sidebar, the phone bottom bar with "More", the area tabs, the role homes and every post-login redirect; schools and the platform share one shell (`components/layout/app-shell.tsx`). Each area's existing pages appear as its tabs until Phases 3–5 rebuild them. Component set in `components/ui` (PageShell, DataTable, StatusBadge, EmptyState, ConfirmDialog, Sheet, DropdownMenu, FormField, Toaster); dialogs and menus run on Headless UI until the Radix packages can be installed. One reserved-slug list on both sides, slugs validated (lowercase letters, digits, hyphens) and unique regardless of case; links use the slug. The operator's pages moved to `/platform/...` (`/platform/login` signs in); old `/super-admin/...` page links redirect there permanently, while the backend API stays at `/api/v1/super-admin/...`. Not done: Playwright smoke tests (packages can't be installed offline).

- Design system setup (design brief §4): shadcn/Radix components, tokens, `PageShell`, `DataTable`, `StatusBadge`, `EmptyState`, `ConfirmDialog`.
- New URL scheme (`/{school}`, `/platform`), slug-only links, reserved slugs.
- Role→menu config, sidebar and phone bottom navigation; role homes.
- Redirects from old URLs.

Exit: every role reaches its home and menu items on phone and desk; no links to missing pages; Playwright smoke test per role.

## Phase 3: School year and enrollment (2–3 weeks)

**Status (Oct 2026): built, not yet tried with a pilot school.** One enrollment table (`class_enrollments` merged into `enrollments.class_id`, with the database keeping each enrollment's year, grade and section equal to its class's); one class per level and section per year enforced; sign-in with email or username (email optional); year setup wizard (`/{school}/academics/setup`, API in `phase3-api.md` §1) with copy-from-last-year; Students area (directory, profile with tabs, admit-and-enroll, spreadsheet import with check-then-save); Staff area (directory, profile, add). Still open: the academic cleanup in schema plan §4 (semester date columns on `academic_years`, sponsor stored three ways, `schedules.class_id` rename) and `enrollment_terms`; student list search/class filter on the server; a per-student fees endpoint; per-student ID card view.

- Schema plan steps 5–6: enrollment unification, academic cleanup.
- Year setup wizard with "copy last year".
- Students area: directory, profile with tabs, admit-and-enroll form, spreadsheet import with preview, year-end promotion.
- Username sign-in: `users.username` unique per school, generated for accounts without an email; login by email or username.
- Staff area: directory, profile, assignments.

Exit: a new school year for a 12-class school can be set up in under an hour by someone who hasn't seen the app (tested with a pilot school).

## Phase 4: Grades and report cards (2–3 weeks)

**Status (Oct 2026): built, not yet tried with a pilot school.** One grading model (design and decisions in `phase4-design.md`): assessments per class subject and period (or semester exam), score entries, publication per class and period/semester, pass mark per school. Period grade = weighted category averages; semester = (P1+P2+P3+exam)/4; yearly = mean of semesters. Gradebook (desk grid, phone list), Review and publish, Report cards (A4 print, whole class), student "My results" and parent "Results" (published only). Marks only by the class subject's teacher or admins; old grade endpoints retired. Still open: old `exams`/`grades` tables and the period/semester publish toggles to remove; report card remarks; the grading-schema "categories status" check still reads the old marks.

- Schema plan step 7: assessment unification, result publications.
- Gradebook (desk grid, phone entry), review and publish, report cards (print), remedial.

Exit: one full period of marks entered, published and printed at the pilot school.

## Phase 5: Fees and parent portal (3 weeks)

- Schema plan step 8: finance rebuild with receipts, allocations, adjustments, currency.
- Record payment and receipt, arrears, collection report.
- Parent portal: child switcher, attendance, published results, fees and receipts.

Exit: all payments at the pilot school recorded with receipts for a month; parents can see balances and results.

## Phase 6: Communication (2 weeks)

- Schema plan step 9: notification preferences, delivery log, files table and object storage (move excuse documents).
- `MessageSender` interface with in-app and email senders; absence, results and payment alerts; announcements. SMS sender left as a stub behind a setting (on hold).
- Offline scan queue for gates.

Exit: absence alerts in parents' in-app inbox (and email where set) within 15 minutes of the cut-off at the pilot school, with a delivery log.

## Phase 7: Platform billing (2 weeks)

- Schema plan step 10: plans priced per user, monthly usage counts, subscriptions, invoices, features.
- Operator screens for plans and billing; feature switches drive navigation.

Exit: a school can be put on a plan, invoiced and suspended for non-payment from the platform screens.

## Testing strategy (all phases)

- Every module ships with service tests (business rules) and API tests (permissions and isolation), following `tests/attendance_fixtures.py` and `tests/test_security.py`.
- The route-auth test and the cross-school tests run on every pull request and block merges.
- Each phase ends with a pilot-school session; findings become issues before the next phase starts.

## Deployment (Railway)

- Database: after the first `alembic upgrade head` (owner login), run `scripts/create_app_db_role.sql` once and give the API the `sms_app` login.
- Services: backend (`alembic upgrade head` on release, then uvicorn), frontend (Next.js), Postgres, Redis, cron (`python -m scripts.close_attendance_days` every 30 minutes), object storage bucket.
- New secrets generated for Railway (`SECRET_KEY`, `ATTENDANCE_QR_SECRET`, database and storage credentials); none of the values from the old `.env` files.
- `DEBUG` unset in production; `CORS_ORIGINS` set to the frontend URL only.
