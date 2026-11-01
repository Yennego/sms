# Phase 7: Platform billing (design)

Scope from the implementation plan:
- schema plan §9: prices per user, monthly usage, subscriptions, invoices and features;
- operator screens for prices and billing;
- feature switches drive navigation.

The commercial rules are in PRD §8. This document adds the decisions taken on 1 Nov 2026 and the contract between the backend and the screens.

## 1. Decisions

| Topic | Decision |
|---|---|
| Plans | One price list for every school. Features (Fees, SMS, …) stay as per-school switches set by the operator (`tenant_settings.features`, as `enable_finance` works today). Several plans can come later. |
| Prices | Set after the pilot, so they are data, not code: `staff_per_month`, `family_per_month` and `term_minimum`, each in USD and LRD, with an effective date. The price in force when an invoice is issued applies. |
| Billing periods | The school's semesters in the app. A calendar month is billable when it overlaps a semester; months between semesters (holidays) are free. |
| Staff | Billed while the account exists and is active: the active staff count when the invoice is issued × the term's billable months. "Staff" means every account that isn't only a student or a parent. Platform accounts are never counted. |
| Parents and students | Billed only in months they signed in. A sign-in (or a session refresh) records the user's month once in `user_activity_months`. |
| Invoice timing | At the start of each semester, one invoice: staff for the coming term, plus the parents and students active in each month of the previous term, plus a top-up to the term minimum if the total is below it. |
| First term | Free for a new school: its first term invoice is issued with a 100% "first term free" line, so the record exists and nothing is owed. |
| Currency | Each invoice is priced in USD and LRD; the school's first payment on an invoice fixes its currency (as with student fees). |
| Payments | Both: the operator records bank, mobile money or cash payments with a reference and a receipt is issued; and an online-payment slot (`PaymentProvider` interface, provider and provider reference on the payment, a webhook route) with no live provider yet. |
| Non-payment | Due 30 days after issue. Reminders to the school's admins (in-app and email, through Phase 6 `notify`) on the due date and 7 and 14 days after. 30 days overdue → **read-only**; 60 days → **suspended**. Paying restores access at once. The operator can extend a school's grace (a date until which no status change happens) or mark it **dormant** (free, read-only, kept a year). |
| Read-only | Everyone can sign in, view and print; every change is refused (403 with a message naming the amount due), except paying, signing in and out, changing one's own password and the export. |
| Suspended | Only the school's admins can sign in, to see the amount due and export data. |
| Export | A school admin can download a full export at any time (a zip of CSVs: students, guardians, enrollments, published results, fee payments). Data is never deleted for non-payment. |

## 2. Rules

- Money is Decimal / NUMERIC(12,2) and sent as strings, as in Phase 5. Never add USD and LRD.
- Billing tables belong to the platform, not to a school's own data, but each row names its school: platform tables get no row level security bypass for schools. School admins read their own invoices through dedicated endpoints filtered by their school.
- Issuing a term's invoice is idempotent per school and semester (unique), so the daily job can run any number of times.
- Status changes are computed by the daily job and stored with their reason and date; the API reads the stored status (cheap), never recomputes per request.
- The old `tenants.plan_type`, `plan_amount` and `subscription_status` columns are replaced and dropped.

## 3. Tables

- `platform_prices`: `id, effective_from, staff_per_month_usd, staff_per_month_lrd, family_per_month_usd, family_per_month_lrd, term_minimum_usd, term_minimum_lrd, created_by, created_at`.
- `user_activity_months`: `tenant_id, user_id, month (date, first of month)`, unique `(tenant_id, user_id, month)`.
- `school_subscriptions`: one per school: `tenant_id, status (trial|active|read_only|suspended|dormant), status_since, status_reason, grace_until, first_term_free_used, created_at, updated_at`.
- `platform_invoices`: `id, tenant_id, number (PINV-2026-00001, per platform per year), semester_id, period_start, period_end, issued_at, due_date, currency (null until the first payment), status (issued|void), void_reason, voided_by, voided_at`. Unique `(tenant_id, semester_id)`.
- `platform_invoice_lines`: `invoice_id, kind (staff|family|minimum|first_term_free|adjustment), description, quantity, unit_usd, unit_lrd, amount_usd, amount_lrd`.
- `platform_payments`: `id, invoice_id, tenant_id, receipt_number (PRCPT-2026-00001), amount, currency, method (bank|mobile_money|cash|online), reference, provider, provider_ref, received_at, recorded_by, voided_at, void_reason`.
- `platform_reminders`: `invoice_id, kind (due|due_7|due_14|read_only|suspended), sent_at`, unique `(invoice_id, kind)`.

## 4. Permissions

| Action | Who |
|---|---|
| Prices, issuing and voiding invoices, recording payments, grace and dormant | super-admin (platform) |
| See own school's invoices, status and amount due; download a receipt; export | school admin (`admin` role) |

## 5. API

Platform (under `/api/v1/super-admin/billing`):
- `GET/POST /prices` (list, add a new price list with its effective date).
- `GET /schools?status&q&page` → per school: name, status, amount due per currency, oldest unpaid due date, staff count, last term's family months.
- `GET /schools/{tenant_id}` → subscription, usage by month, invoices with lines and payments.
- `POST /schools/{tenant_id}/invoices {semester_id}` (issue now; the daily job also does it), `POST /invoices/{id}/void {reason}`.
- `POST /invoices/{id}/payments {amount, currency, method, reference, received_at?}` → receipt; `POST /payments/{id}/void {reason}`.
- `PUT /schools/{tenant_id}/subscription {grace_until?, dormant?: bool}`.
- `GET /invoices?status&from&to&page` (all schools), `GET /summary` (billed, collected and outstanding per currency, schools per status).
- `POST /payments/webhook/{provider}` (public route; no provider enabled, so it answers 404 until one is configured).

School (under `/api/v1/billing`):
- `GET /status` → `{status, status_since, amount_due {USD?, LRD?}, oldest_due_date, read_only_on, suspended_on, message}`; every signed-in user of the school may read it (the app shell shows the banner).
- `GET /invoices`, `GET /invoices/{id}` (admin), `GET /payments/{id}/receipt` (admin).
- `GET /export` (admin) → zip.

Enforcement: a dependency on the API router reads the school's stored status: read-only refuses non-GET routes except an allow-list; suspended refuses everyone but school admins (and only the allow-list for them). Platform routes are never affected.

## 6. Screens

- **Platform → Billing:** summary; schools list with status and amount due; school detail (usage, invoices, record payment, void, grace, dormant); price list.
- **School → Settings → Billing (admin):** status, amount due, invoices and receipts, how to pay (bank and mobile money details from platform settings), export.
- **App shell banner (everyone in the school):** due soon / overdue / read-only / suspended, with the amount for admins and a plain line for others ("Your school's account is read-only. Ask the school office.").

## 7. Jobs

- `python -m scripts.run_platform_billing` daily: issue term invoices for semesters starting today or earlier without one, send due reminders, move statuses (read-only, suspended; back to active when paid).

## 8. As built (backend, 1 Nov 2026)

Migration `c9e4a7b2f5d1` (after `b6f2d9a4e8c1`). Code: `src/db/models/billing/`, `src/services/billing/` (`platform_billing.py` rules and views, `access.py` enforcement and usage, `export.py`, `providers.py`), `src/api/v1/endpoints/billing/school.py`, `src/api/v1/endpoints/super_admin/billing.py`, `scripts/run_platform_billing.py`. Tests: `tests/test_platform_billing.py`.

### Deviations from §1-§7

- **Tables.** Extra table `platform_counters (name, year, last_number)` numbers invoices (`PINV`) and receipts (`PRCPT`) per year, locked while numbering. `platform_invoices` also has `price_id` (the price list used), `issued_by` (empty when the daily job issued it), `created_at`, `updated_at`. `platform_payments` also has `voided_by` and `created_at`, and `(provider, provider_ref)` is unique. `platform_invoice_lines` has `id` and `created_at`. `school_subscriptions` is keyed by `tenant_id`. `user_activity_months` is keyed by `(tenant_id, user_id, month)`.
- **One live invoice per school and semester.** The unique key covers issued invoices only, so the operator can issue a semester again after voiding its invoice. The daily job never reissues a semester that has a void invoice. Voiding the invoice that carried the "first term free" line gives the free term back.
- **The daily job issues only the semester in progress** (start ≤ today ≤ end), never past semesters. With no price list in force it issues nothing (the job logs "no price list"; `POST .../invoices` answers 409 "Set the platform price list first").
- **A month shared by two semesters** is billed in the earlier one only.
- **Previous term** means the school's semester just before this one (by start date, across school years). Family user-months are counted by each account's current roles: an account is "family" when all its roles are the built-in `student` and/or `parent`, or, with no role, when its type is student or parent. Every other account is staff, including a school's custom roles; platform accounts are left out. Activity is recorded for every school account (not platform accounts). Staff signing in are billed as staff, never as family.
- **Statuses.** A school without a `school_subscriptions` row counts as `trial`; the row is created on the first billing action. `trial` lasts while no invoice has charged anything (the free first term), then `active`. Grace (`grace_until`, inclusive) only stops the status getting worse; paying always restores access. Dormant is set and lifted by the operator only; lifting it recomputes the status from the invoices. Dormant behaves like read-only.
- **Migration of existing schools:** `active` and `past_due` → `active`, because no invoice exists yet under the new rules; `canceled` → `dormant`. `first_term_free_used` is false, so each pilot school's first platform invoice is free.
- **Reminders.** If the job misses days, every due reminder that has come due is recorded, but only one alert is sent (the latest). The read-only and suspended notices are recorded against the oldest unpaid invoice, when the status moves. They use the new alert event `billing_reminder`, sent to the school's active `admin` users. It is not in the email preferences list, so it can't be switched off. The link is `/{school}/settings/billing`.
- **Enforcement allow-list.** Besides sign-in, sign-out, refresh and change password, read-only also allows marking one's own inbox read (`POST /communication/inbox/read-all`, `.../inbox/{id}/read`) and the three reads the app sends as POST (`POST /people/students/bulk-enrollments`, `/academics/promotions/evaluate`, `/academics/remedial/identify`). When suspended, a school admin may also GET `/auth/me`, `/tenants/{tenant_id}/settings`, `/tenants/self/profile`, `/communication/inbox`, `/communication/inbox/unread-count` and everything under `/billing`. Anyone else at a suspended school may only GET `/billing/status` and sign out. Sign-in and refresh refuse non-admins of a suspended school (403).
- **Refusals** are 403 with the header `X-School-Billing-Status: read_only|suspended|dormant` and `detail` set to the same line as the banner's `message` (with the amount for admins).
- **Extra endpoints:** `GET /super-admin/billing/invoices/{id}` and `GET /super-admin/billing/payments/{id}/receipt`. `POST /payments` takes `method` bank, mobile_money or cash; `online` is only recorded through a provider.
- **Removed:** `PATCH /super-admin/tenants/{id}/subscription`, and the `plan_type`, `plan_amount` and `subscription_status` fields of the tenant schemas. Changed: the platform dashboard's revenue figures now come from platform billing (below).
- **Fixed on the way:** `POST /auth/refresh` failed with 401 on every valid refresh token (a local import shadowed `TokenBlacklistService`).

### Response fields

Money is a string with two decimals; a currency map is `{"USD": "30.00", "LRD": "5700.00"}`, listing only the currencies that apply. Dates are `YYYY-MM-DD`, times ISO 8601 UTC.

**Price list:** `id, effective_from, staff_per_month_usd, staff_per_month_lrd, family_per_month_usd, family_per_month_lrd, term_minimum_usd, term_minimum_lrd, created_by, created_by_name, created_at, in_force`. `POST /prices` takes `effective_from` and the six amounts (strings or numbers). A second price list on the same date gets 409.

**Invoice (list row):** `id, tenant_id, number, semester_id, semester_name, period_start, period_end, issued_at, due_date, currency (null until the first payment), status (issued|void), total {USD, LRD}, paid {currency: amount}, balance, owing (bool), void_reason, voided_at`. `balance` holds both currencies until the first payment, then only the locked one; it is `{}` when void. The platform list adds `school_name`.
**Invoice (detail)** adds `lines: [{id, kind, description, quantity, unit_usd, unit_lrd, amount_usd, amount_lrd}]` (the `first_term_free` line is negative) and `payments: [payment]`. `POST /schools/{tenant_id}/invoices` returns the detail plus `created` (false when the live invoice already existed).

**Payment:** `id, invoice_id, receipt_number, amount, currency, method, reference, provider, provider_ref, received_at, recorded_by, recorded_by_name, voided, voided_at, voided_by_name, void_reason`.
**Receipt** (record payment, void payment, `GET .../receipt`) adds `amount_in_words, invoice_number, invoice_total (in the payment's currency), balance_now, school {id, name, code}`. Errors: overpayment 409 "Balance is USD 20.00"; wrong currency 409 "This invoice is being paid in USD"; voiding an invoice with payments 409. Voiding the last payment unlocks the invoice's currency.

**School row** (`GET /schools`, paged `{items, total, page, page_size}`; `status` filter, `q` on name, code or address): `tenant_id, name, code, domain, is_active, status, status_since, grace_until, amount_due, oldest_due_date, staff_count, last_term_name, last_term_family_months`.
**School detail** adds `subscription {tenant_id, status, status_since, status_reason, grace_until, first_term_free_used}`, `usage: [{month, staff_signed_in, family_signed_in}]` (the last 12 months), `current_semester {id, name, start_date, end_date} | null`, `semesters: [{id, name, start_date, end_date}]`, `price_in_force (price list) | null` and `invoices: [invoice detail]`.
`PUT /schools/{tenant_id}/subscription {grace_until?: date|null, dormant?: bool}` returns the `subscription` object.

**`GET /invoices`** (`status` all|issued|void|owing|paid, `from`, `to` on the issue date, `page`, `page_size`) returns `{items, total, page, page_size}`.
**`GET /summary`** returns `{billed, collected, outstanding, not_yet_paid: {invoices, USD, LRD}, schools: {trial, active, read_only, suspended, dormant}}`. `billed` and `outstanding` count invoices whose currency is fixed. Invoices with a charge and no payment yet are under `not_yet_paid`, priced in both currencies.

**`GET /billing/status`** (any signed-in user of the school) returns `status, status_since, grace_until, amount_due (null for non-admins), oldest_due_date, read_only_on, suspended_on, banner, is_admin, message`. `banner` is one of none, due_soon (unpaid, due within 7 days), overdue, read_only, suspended or dormant. `message` is the banner line: with the amount for admins (for example "Your school's account is read-only: USD 30.00 (or LRD 5,700.00) is overdue. Pay it to restore access."), or a plain line for others ("Your school's account is read-only. Ask the school office."). It is null when there is nothing to show; for non-admins it is also null when the banner is due_soon. `read_only_on` and `suspended_on` take any grace into account.
`GET /billing/invoices` returns a list of invoice rows. `GET /billing/invoices/{id}` returns an invoice detail. `GET /billing/payments/{id}/receipt` returns a receipt. All three are for school admins, and an id from another school gets 404.
`GET /billing/export` (admin) returns a zip: `students.csv, guardians.csv, enrollments.csv, results.csv` (scores of terms published for the class) and `fee_payments.csv`, UTF-8 with BOM.

**Webhook** `POST /super-admin/billing/payments/webhook/{provider}` (public): 404 "Unknown payment provider" while none is registered. Once a provider is registered, it returns `{recorded, payment_id?, receipt_number?}`.

**Platform dashboard** (changed): `GET /super-admin/dashboard/system-metrics` → `revenue_metrics: {billed, collected, outstanding, not_yet_paid, collected_usd_last_30_days}`. `GET /super-admin/dashboard/revenue-by-tenant` → `[{tenant_id, tenant_name, billing_status, staff_count, amount_due, collected_usd_last_30_days}]`. `GET /super-admin/dashboard/recent-tenants` rows have `billing_status` instead of `plan_type, plan_amount, subscription_status`. The churn and forecast analytics use USD received in the last 30 days.
