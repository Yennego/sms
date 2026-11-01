# Schema plan

Database changes for the remodel, in the order they should be migrated. Each step is a separate Alembic migration (or a small group) that can ship on its own, with a data migration and a tested downgrade.

Current state in brief: row-level multi-tenancy (`tenant_id` on most tables via `TenantMixin`), one Alembic head (`a7d2e5c9f413`), local data clean (no cross-school references found in the Oct 2026 audit).

## 1. Principles

- Every school-owned table has `tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT`.
- References between school tables are composite: `(tenant_id, x_id) REFERENCES x(tenant_id, id)`.
- Natural keys are unique per school: `UNIQUE (tenant_id, admission_number)`, not globally.
- Status values are PostgreSQL enums or check constraints, lowercase, one convention.
- Derived numbers (balances, rates) are views or computed in queries, not stored columns.
- Typed settings tables per module, not JSON blobs (the `attendance_settings` table is the model).
- Soft delete (`deleted_at TIMESTAMPTZ NULL`) on people and enrollments.

## 2. Tenant integrity

| Change | Why |
|---|---|
| `users.tenant_id` NOT NULL + FK to `tenants` | Today nullable with no FK |
| `UNIQUE (tenant_id, id)` on every school parent table | Target of composite FKs |
| Composite FKs on children: enrollments, class_subjects, classes (teacher, section, grade), sections (sponsor), grades, attendance, fees, payments | Database rejects cross-school links |
| `students.admission_number`, `teachers.employee_id` unique per school | Today global: the second school's `STU0001` fails with a 500 |
| `tenant_id` added to `notifications`, `message_recipients`, `parent_student` | Today these can't be scoped by school |
| `tenant_settings.tenant_id` UNIQUE | One settings row per school |
| Tenant FKs from `ON DELETE CASCADE` to `RESTRICT` | A school delete must be an explicit purge job |
| Row Level Security policies on all school tables | Defence in depth (see technical requirements §3) |

**Decided: one account per school.** Each account belongs to exactly one school. Because the sign-in page already knows the school from the URL, email only needs to be unique per school: `UNIQUE (tenant_id, lower(email))` replaces the global unique, so a parent can use the same email at two schools as two separate accounts. **Decided: sign in with email or username, not phone** (families share phones). Add `users.username`, `UNIQUE (tenant_id, lower(username))`, generated for accounts without an email (students, many parents); `users.phone_number` stays a contact field and is not unique. Login looks the user up by school plus email or username (Phase 3, with the admit-and-enroll form). Super-admin accounts belong to the platform school.

## 3. Roles and permissions

| Change | Why |
|---|---|
| `user_roles` gets `tenant_id NULL` and `is_system BOOLEAN` | System roles (`tenant_id NULL`) are read-only to schools; schools can add custom roles |
| `UNIQUE (tenant_id, name)` replacing global `UNIQUE (name)` | Custom role names per school |
| `user_role_association` gets `tenant_id` | Assignment scoped to the school |
| Remove `admin.manage_tenants`, `manage_permissions` from the school admin role | Platform-only permissions |
| Seed migration for system roles and their permissions | Today roles are created ad hoc |

## 4. Academic structure

| Today | Change |
|---|---|
| `AcademicGrade` (= grade level) vs `Grade` (= a mark) | Rename to `grade_levels` and `score_entries` (keep table names via `__tablename__` until a later rename migration if needed) |
| `academic_years.semester_1_start/end`, `semester_2_*` plus `semesters` and `periods` tables | Drop the semester date columns; `semesters` and `periods` are the single source |
| Sponsor stored on `sections.class_teacher_id`, `classes.class_teacher_id` and `teachers.is_class_teacher` | Keep `classes.class_teacher_id` only; derive "is a sponsor" from it |
| `schedules.class_id` actually points to `class_subjects` | Rename column to `class_subject_id` |
| `timetables.timetable_data` JSON alongside `schedules` rows | Keep `schedules` as the source; drop the JSON timetable |

## 5. Enrollment

| Today | Change |
|---|---|
| Two tables: `enrollments` (student, year, grade, section; legacy string columns, `semester_1/2_status`) and `class_enrollments` (student, class, year), used in 11 files | One `enrollments` table: `(tenant_id, student_id, academic_year_id, class_id, status, enrolled_on, left_on)`, unique per student and year |
| Semester status columns | `enrollment_terms (enrollment_id, semester_id, status)` |
| Promotion lists of subject ids in JSON (`failed_subject_ids`, `core_subject_ids`) | Join tables with real FKs |

Data migration: map each `class_enrollments` row onto the matching `enrollments` row by student and year; report conflicts before switching reads. Attendance already reads from `enrollments`.

## 6. Assessment and grading

| Today | Change |
|---|---|
| `assessments`, `exams`, `assignments` repeat the same columns; `grades.assessment_id` has no FK and points to any of them | One `assessments` table with `kind` (test, assignment, exam, project) and kind-specific nullable columns; `score_entries.assessment_id` FK |
| `grades.period_number` and `semester` legacy columns next to `period_id` | Keep `period_id` only |
| Publishing state per page | `result_publications (tenant_id, class_id, period_id, published_at, published_by)` |

## 7. Finance

| Today | Change |
|---|---|
| `student_fees.student_id` FK to `users` | FK to `students` (composite with tenant) |
| No currency | **Decided: USD and LRD, locked per student per school year.** Fee schedules store `amount_usd` and `amount_lrd`. `student_fee_accounts (tenant_id, student_id, academic_year_id, currency NULL)`, unique per student and year; `currency` is NULL until the first payment, which sets it, and it can't change after. Invoices show both amounts while the currency is unset, then only the locked one. `payments.currency` must equal the account's currency (enforced in the service and by a check trigger); a payment in the other currency is rejected with a message naming the locked currency |
| `balance` and `amount_paid` stored on `student_fees` | Drop; compute from invoice lines and payment allocations (view `student_fee_balances`) |
| Free-text uppercase statuses | Enum: `draft`, `issued`, `partially_paid`, `paid`, `void` |
| No receipt, no receiver, no void | `payments`: `receipt_number` (unique per school, sequential), `received_by`, `method` (cash, bank, mobile_money), `reference`, `voided_at`, `void_reason` |
| `fee_installments` not linked to payments | `payment_allocations (payment_id, invoice_id, amount)` |
| No discounts | `fee_adjustments (invoice_id, kind: discount/scholarship/waiver, amount, reason, approved_by)` |

## 8. Communication and files

| Change | Why |
|---|---|
| `notification_preferences (tenant_id, user_id, channel, event, enabled)` | Parent rules (channels, quiet hours) have no place today but untyped `users.preferences` |
| `message_deliveries (message_id, recipient_id, channel, status, provider_ref, sent_at)` | Delivery log for in-app and email now, SMS later |
| `files (tenant_id, id, storage_key, content_type, size, uploaded_by, created_at)`; `attendance_documents` and `resources` point to it | Move file bytes out of Postgres and off the wiped disk |

## 9. Platform (SaaS)

Replace `tenants.plan_type`, `plan_amount`, `subscription_status` with:

- `plans (code, name, price_per_user, monthly_minimum, currency, limits JSON)` (pricing is per user)
- `tenant_usage (tenant_id, month, billable_users)`, counted at month end from `users.last_login` (see PRD §8 for what counts)
- `subscriptions (tenant_id, plan_id, status, started_at, renews_at, cancelled_at)`, where `status` is `trial`, `active`, `read_only`, `suspended` or `dormant`; the API refuses writes for `read_only` and all but the admin for `suspended`
- `tenant_invoices`, `tenant_payments`
- `tenant_features (tenant_id, feature, enabled)` (feature switches per plan)

## 10. Audit

Already split in Oct 2026: `activity_logs` (school, create/update/delete only) and `super_admin_activity_logs` (platform, with `target_tenant_id`). Remaining: a migration to redact the 9 existing rows that stored password or token fields in `new_values`.

## 11. Migration order

Steps 1–4 are done (Oct 2026). They were written as four migrations, run up, down and up on a copy of the local data, then folded into a single **baseline migration** (`e4b8a1d6c3f2_baseline.py`, loading `alembic/baseline/schema.sql` and the role/permission seed), which replaced the old history: it builds a database from empty, and databases already at `e4b8a1d6c3f2` need no change. New changes are new migrations on top. Deviations from the plan: username sign-in comes with Phase 3; `user_role_association` keeps no `tenant_id` (custom-role ownership is checked when roles are assigned); `activity_logs` has no tenant foreign key (it outlives deleted schools).

1. Audit redaction; `users.tenant_id` NOT NULL; per-school uniques (including `users.email`); `tenant_settings` unique.
2. `UNIQUE (tenant_id, id)` everywhere; composite FKs table by table (each preceded by a check query that must return zero rows).
3. RLS policies and the bypass role.
4. Roles: system vs custom.
5. Enrollment unification (with conflict report).
6. Academic cleanup (sponsor, semester columns, schedule column rename).
7. Assessment unification and result publications.
8. Finance rebuild (new tables alongside old, backfill, switch reads, drop old).
9. Communication, files and object storage.
10. Platform billing tables.
