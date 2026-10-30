# Phase 5 design: fees and the parent portal

Replaces today's finance module, where balances are typed in, payments race, there are no
receipts, currency, voids or discounts, filters are ignored, deleting a fee deletes its payments,
and parents can't see anything (October 2026 review).

## 1. Decisions (school owner, October 2026)

- **Billing per semester, with installments.** A fee schedule sets, per school year, semester,
  grade level and fee category, an amount in USD and/or LRD. Each semester has an installment plan
  (due dates with a share of the bill, e.g. 50% by 15 Sep, 50% by 15 Nov). Families may pay any
  amount any time; installments only decide what counts as overdue.
- **Currency per student per year** (decided in Phase 0): a student's first payment in a school
  year fixes that student's currency (USD or LRD) for the rest of the year; later payments in the
  other currency are refused. Until then, bills show both amounts.
- **Receipt numbers restart each school year**, per school: `2026-00001`, `2026-00002`, … (the
  year is the school year's start year). Never reused or skipped; a voided receipt keeps its number.
- **Voids:** the person who recorded a payment may void it the same day (school time zone) with a
  reason; after that only users with `approve_financial_transactions` (principal/admin). A voided
  receipt stays visible marked VOID; nothing is ever deleted.
- **Arrears and report cards — school decides:** a finance setting "Hold report cards when fees
  are overdue" (default off). When on, students and parents can't open or print report cards while
  the student has an overdue balance for that year, unless the school allows that student
  (per-student override). Staff always see everything; the public verification page is unaffected.

## 2. Money rules

- Money is stored as `NUMERIC(12,2)` and computed with `Decimal` — never floats. USD and LRD are
  never added together; every total is per currency.
- **Balances are calculated, never typed:** owed = invoice lines − adjustments; paid = allocations
  of non-void payments; balance = owed − paid.
- **Overdue** = for each installment whose due date has passed, the cumulative share of the
  invoice due by then minus what has been paid against it; overdue if > 0.
- Payments are **allocated** automatically to the student's issued invoices of that year, oldest
  semester first. A payment larger than the outstanding total is refused ("Balance is USD 120.00").
- Recording a payment locks the student's account row (`SELECT … FOR UPDATE`) so two cashiers can't
  race; receipt numbers come from a locked per-school, per-year counter.

## 3. Data model (one migration; old tables moved across, then dropped)

| Table | Columns |
|---|---|
| `fee_categories` (kept) | name, description, `is_active`; deleting a category with schedules is refused |
| `fee_schedules` | academic_year_id, semester_id, grade_id (NULL = every grade level), category_id, amount_usd NULL, amount_lrd NULL (at least one), unique (year, semester, grade, category) |
| `installment_plans` | academic_year_id, semester_id, sequence, due_date, percent; percents per semester add up to 100 |
| `student_fee_accounts` | student_id (FK students), academic_year_id, currency NULL ('USD'/'LRD'), currency_locked_at, report_card_hold_override (bool, default false); unique (student, year) |
| `invoices` | account_id, semester_id, status (`issued`, `void`), issued_at, issued_by; unique (account, semester) |
| `invoice_lines` | invoice_id, schedule_id NULL, category_id, description, amount_usd NULL, amount_lrd NULL |
| `fee_adjustments` | invoice_id, kind (`discount`, `scholarship`, `waiver`), percent NULL or amount_usd/amount_lrd, reason, approved_by, created_at |
| `payments` | account_id, receipt_year, receipt_seq, receipt_number ('2026-00001', unique per school), amount, currency, method (`cash`, `bank`, `mobile_money`), reference, note, received_by, received_at, voided_at, voided_by, void_reason |
| `payment_allocations` | payment_id, invoice_id, amount |
| `receipt_counters` | academic_year_id (or year label), last_number |
| `finance_settings` | tenant (unique), hold_report_cards_on_arrears (bool, default false) |

All with composite tenant keys and the `tenant_isolation` row level security policy.

**Moving today's data** (14 student fees, 14 installments, 2 payments locally): fee structures →
schedules in USD (their semester found from the due date within the year's semesters);
student fees → an account + invoice + one line each; payments → payments in USD with receipt
numbers in date order, allocated to their invoice, locking the account to USD; old installments
→ an installment plan per semester from their due dates where they agree, otherwise a single
installment at the semester's end (reported). Old tables are then dropped. `expense_categories` /
`expenditures` stay as they are.

`parent_student` gains `tenant_id` (from the student), with a composite key.

## 4. Permissions

| Action | Permission |
|---|---|
| See fees, accounts, payments, reports | `view_financial_data` |
| Categories, schedules, installment plans, issue invoices | `create_invoices` |
| Record a payment; void own payment the same day | `record_payments` |
| Discounts/scholarships/waivers; void older or others' payments; reset a currency with no valid payments; report-card hold overrides | `approve_financial_transactions` |
| Finance settings | `manage_financial_data` |
| Collection and arrears reports | `generate_financial_reports` (or `view_financial_data`) |
| A family's own statement and receipts | parent linked to the student; the student themself |

The migration grants `record_payments`, `create_invoices`, `approve_financial_transactions` and
`generate_financial_reports` to the `admin` system role (small schools run fees themselves).

## 5. API (`/api/v1/finance`)

- `GET/PUT /settings` → `{hold_report_cards_on_arrears}`
- Categories: `GET/POST /categories`, `PUT/DELETE /categories/{id}`
- Schedules: `GET /schedules?academic_year_id&semester_id&grade_id`, `POST`, `PUT /{id}`, `DELETE
  /{id}` (409 if invoiced)
- Installment plans: `GET /installment-plans?academic_year_id&semester_id`, `PUT` (replaces the
  semester's plan: `[{due_date, percent}]`)
- Invoices: `POST /invoices/issue {academic_year_id, semester_id, grade_id?, class_id?}` → issues
  invoices for every student enrolled (active) in that year, adding lines for schedules not yet on
  the invoice; idempotent; returns counts. `POST /invoices/{id}/void {reason}` (approve; refused
  when payments are allocated).
- Accounts: `GET /accounts?academic_year_id&class_id&status=all|owing|overdue|paid&q&sort&page
  &page_size` (server-paged, like the roster) → items `{student_id, name, admission_number,
  class_name, currency, owed: {USD?, LRD?}, paid, balance, overdue, last_payment_at}` + totals per
  currency. `GET /accounts/{student_id}?academic_year_id` → full statement: account, invoices with
  lines and adjustments, installment schedule with what's due/overdue, payments with allocations,
  balance (per currency until locked).
- Adjustments: `POST /invoices/{id}/adjustments`, `DELETE /adjustments/{id}`.
- Payments: `POST /payments {student_id, academic_year_id, amount, currency, method, reference?,
  note?}` → the payment with receipt; `GET /payments?from&to&method&received_by&q&page` (paged);
  `GET /payments/{id}` (receipt data); `POST /payments/{id}/void {reason}`.
- Reports: `GET /reports/collections?from&to` (totals by day, method, receiver, per currency) and
  `GET /reports/arrears?academic_year_id&class_id` (per class: students overdue, amount overdue
  per currency).
- Family: `GET /finance/family/students` (parent: linked children; student: self) → `[{student_id,
  name, class_name, currency, balance, overdue}]`; `GET /finance/family/accounts/{student_id}
  ?academic_year_id` (statement, read-only); `GET /finance/family/payments/{id}` (receipt).
- Report cards for students/parents (`/academics/gradebook/report-cards/students/{id}`) answer 403
  "This report card is held until school fees are paid. Please contact the school office." when the
  hold applies.

### As built (backend, October 2026)

Migration `a5d1e8c3f7b2_phase5_fees`. Code: `src/db/models/finance/fees.py`,
`src/services/finance/{ledger,fee_service}.py`, `src/api/v1/endpoints/finance/{fees,family}.py`.
Tests: `tests/test_finance.py`.

General
- **Money is JSON strings with two decimals** (`"120.00"`); inputs accept strings or numbers (at most
  2 decimals). Per-currency values are objects `{USD?: "…", LRD?: "…"}`: before the currency is
  locked both keys (when every line is priced in both), after only the locked one.
- "Today" and "same day" use the school's time zone (attendance settings; default Africa/Monrovia).
  An installment is overdue the day **after** its due date. A semester with no plan falls due in full
  at the semester's end.
- School-wide totals (accounts list, arrears) count a not-yet-locked student in USD when their bill
  is priced in USD, else LRD, so nothing is counted twice; currencies are never added together.
- Invoices also store `voided_at`, `voided_by`, `void_reason`. Issuing skips a semester invoice that
  was voided (`skipped_void`). Receipt counters are keyed by receipt year (the school year's start
  year), so numbers stay unique per school even if two years start in the same calendar year.
- Schedules: amounts can still change after invoicing (only invoices issued from then on use them);
  year/semester/grade/category can't (409). Categories in use can't be deleted (409).
- Adjustments: a fixed amount must be given in the locked currency, or in every currency of the
  bill before the lock; adjustments can't exceed the bill or leave it overpaid (409).
- `parent_student` has `tenant_id` and composite keys but no row level security (it is read at
  sign-in through `Parent.students`, like `users`/`students`); isolation stays in code.

Endpoints (all under `/api/v1/finance`)
- `GET /settings` → `{hold_report_cards_on_arrears, school_today}`; `PUT /settings` (manage_financial_data).
- Categories → `[{id, name, description, is_active, in_use, created_at, updated_at}]`.
- Schedules → `[{id, academic_year_id, semester_id, semester_name, grade_id, grade_name (null = every
  grade level), category_id, category_name, amount_usd, amount_lrd, invoiced}]`.
- `GET /installment-plans?academic_year_id&semester_id` → per semester `{semester_id, semester_name,
  semester_number, academic_year_id, start_date, end_date, installments: [{id, sequence, due_date,
  percent}], total_percent, default_due_date}`. `PUT /installment-plans?semester_id&academic_year_id`
  with a **bare array** body `[{due_date, percent}]` (sum 100; `[]` removes the plan) → that semester.
- `POST /invoices/issue` → `{students, invoices_created, invoices_updated, lines_added, unchanged,
  skipped_void, no_schedule, problems: [{student_id, student_name, detail}]}`.
- `POST /invoices/{id}/void {reason}`, `POST /invoices/{id}/adjustments {kind, percent | amount_usd/
  amount_lrd, reason}`, `DELETE /adjustments/{id}` → the student's statement.
- `GET /accounts?academic_year_id&class_id&status=all|owing|overdue|paid&q&sort=name|admission_number|
  class|balance|overdue|last_payment&page&page_size` → `{academic_year: {id, name}, items: [{student_id,
  account_id, name, admission_number, class_id, class_name, currency, currencies, owed, paid, balance,
  overdue, status (overdue|owing|paid|none), last_payment_at, report_card_hold_override}], total, page,
  page_size, pages, counts: {all, owing, overdue, paid}, totals: {owed, paid, balance, overdue}}`
  (counts ignore the status filter; totals follow all filters).
- `GET /accounts/{student_id}?academic_year_id` → 404 when the student has no account that year, else
  `{student: {id, name, admission_number, class_id, class_name, grade_name}, academic_year: {id, name},
  account: {id, currency, currency_locked_at, report_card_hold_override, academic_year_id,
  academic_year_name}, currencies, owed, paid, balance, overdue, report_cards_held, report_card_hold:
  {setting_on, override, held}, today, invoices: [{id, semester_id, semester_name, semester_number,
  status, issued_at, issued_by, issued_by_name, voided_at, voided_by_name, void_reason, lines: [{id,
  schedule_id, category_id, category_name, description, amount_usd, amount_lrd}], adjustments: [{id,
  kind, percent, amount_usd, amount_lrd, reason, approved_by, approved_by_name, created_at, value}],
  charged, adjustments_total, owed, paid, balance, overdue}], installments: [{invoice_id, semester_id,
  semester_number, semester_name, sequence, due_date, percent, amount_due, due (= amount_due), paid,
  outstanding, overdue, status: paid|due|overdue|upcoming}], payments: [payment rows + allocations]}`.
  `due` marks the earliest unpaid installment not yet past its date.
- `POST /accounts/{student_id}/reset-currency?academic_year_id` (approve; 409 while a valid payment
  exists) and `PUT /accounts/{student_id}/report-card-hold?academic_year_id {override: bool}`
  (approve) → the statement.
- Payment rows (POST `/payments`, `GET /payments/{id}`, list items): `{id, receipt_number, received_at,
  amount, currency, method, reference, note, student_id, student_name, admission_number, class_name,
  academic_year_name, received_by, received_by_name, voided, voided_at, voided_by, voided_by_name,
  void_reason, amount_in_words, can_void}` (list items add `balance_now`); the receipt and POST add
  `receipt_year, balance_after, balance_now,
  student {id, name, admission_number, class_name}, academic_year {id, name}, allocations [{invoice_id,
  semester_id, semester_name, amount}], unallocated, school {name, logo, address, motto, phone, email,
  seal}`. `balance_after` is `{currency: amount}` as it stood right after the payment, stored on the
  payment (`payments.balance_after`, migration `d2b7e4a9c1f3`) so a reprint shows the same figure; null
  for payments moved from the old tables. `balance_now` is today's balance per currency.
- `GET /payments?from&to&method&received_by&q&status=all|valid|void&academic_year_id&student_id&page
  &page_size` → `{items, total, page, page_size, pages, totals}` (totals: valid payments per currency).
  `GET /payments/receivers?from&to` → `[{user_id, name}]`.
- `GET /reports/collections?from&to` (default today) → `{from, to, totals, count, by_day: [{date, totals,
  count}], by_method: [{method, totals, count}], by_receiver: [{received_by, received_by_name, totals,
  count}], voided: {count, totals}}` (void payments are excluded from everything but `voided`).
- `GET /reports/arrears?academic_year_id&class_id` → `{academic_year, today, classes: [{class_id,
  class_name, students, students_overdue, overdue, balance}], totals: {students, students_overdue,
  overdue, balance}}`.
- Family (parent: linked children; student: self; other school's student 404, unlinked 403, a
  payment you can't see 404):
  `GET /family/students` (current year) → `[{student_id, name, admission_number, class_name,
  academic_year_id, currency, currencies, balance, overdue, next_due: {due_date, amount} | null,
  report_cards_held}]`; `GET /family/accounts/{student_id}?academic_year_id` → the statement with
  `account: {currency, currency_locked_at}`, `payments: [{id, receipt_number, received_at, amount,
  currency, method, reference, voided_at}]` and without `report_card_hold`; `GET /family/payments/{id}`
  → the receipt without `received_by`, `voided_by`, `can_void`.
- The old `/finance/fees/*` routes (including the xlsx/pdf exports and `/fees/summary`) are gone;
  `/finance/expenses/*` is unchanged (view/manage_financial_data); its summary returns a string amount.

## 6. Screens

| Screen | Path | Notes |
|---|---|---|
| Fees overview | `/{school}/finance` | today's collections per currency, owing/overdue totals, quick "Record payment" |
| Student accounts | `/{school}/finance/fees` | server-paged list (owing/overdue/paid tabs, class filter, search); row → statement |
| Statement | `/{school}/finance/accounts/{studentId}` | invoices, installments, payments, adjustments; Record payment; print statement |
| Record payment | dialog/sheet from anywhere | find student, see balance in their currency (or both before lock), amount, currency (fixed once locked), method, reference → printable receipt |
| Receipt | `/{school}/finance/payments/{id}` | A5/receipt print, VOID watermark when voided |
| Payments | `/{school}/finance/payments` | paged list, void with reason |
| Fee setup | `/{school}/finance/structures` | schedules per semester and grade level (USD/LRD), installment plans, categories, "Issue invoices" |
| Reports | `/{school}/finance/reports` | collections (by day/method/receiver) and arrears by class |
| Finance settings | `/{school}/finance/settings` | hold report cards on arrears |
| Parent home | `/{school}/parent` | child switcher; today's attendance, latest results, fee balance, alerts |
| Parent fees | `/{school}/parent/fees` | balance, installments due, payments and printable receipts |
| Student profile → Fees tab | | the statement (read-only) |

Fees area tabs: Overview · Student accounts · Payments · Fee setup · Reports · Expenses · Settings.
