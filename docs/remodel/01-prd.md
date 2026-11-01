# Product requirements: School Management System (remodel)

## 1. Summary

A multi-school (multi-tenant) school management platform for schools in Liberia. Each school runs its daily operations in it: admissions and enrollment, classes, attendance, grades and report cards, fees, and communication with families. A platform operator onboards and bills schools.

The remodel keeps the working parts (school-day and QR attendance, academic structure, the tenant creation wizard) and rebuilds the rest around three goals:

1. **Safe by default.** One school can never see or change another school's data, and nothing works without signing in.
2. **Simple to use.** Each role sees a short, task-first navigation, and common jobs take a few steps instead of a tour of 10 pages.
3. **Works in local conditions.** Phones first, slow and expensive data, unreliable power, many families without email.

## 2. Problem

The current app has the right features but users struggle with it:

- **Too many places for the same thing.** There are three classes areas, three admin dashboards, six grade-entry pages and an old duplicate page tree. Admins don't know which one is real.
- **Hidden setup order.** Starting a school year needs about 10 pages in an order the app never explains. Errors such as "Selected grade has no sections" don't say what to do.
- **Parents are underserved.** They can see attendance only. Grades, report cards and fees are missing.
- **Phones are not supported.** There is no mobile navigation, yet teachers, parents and gate staff mostly use phones.
- **Security was not enforced.** The October 2026 review found that schools could reach each other's data and that some actions needed no login. This was fixed first (see the implementation plan, Phase 0), and the remodel must keep it fixed by design.

## 3. Users

| Persona | Who | Main jobs | Device |
|---|---|---|---|
| Platform operator | Super-admin running the SaaS | Onboard schools, manage plans and billing, support, platform health | Laptop |
| Proprietor / principal | School owner or head | See how the school is doing, approve results, set policy | Phone and laptop |
| School administrator | Office admin, often the main power user | Set up the year, manage students and staff, run reports | Laptop |
| Registrar | Admissions office | Admit, enroll, transfer, promote and graduate students | Laptop |
| Bursar / accountant | Finance office | Fee schedules, record payments, receipts, arrears | Laptop |
| Class sponsor | Teacher responsible for a class | Daily attendance, excuses, class report, parent contact | Phone |
| Subject teacher | Teaches one or more subjects | Enter marks, assignments, timetable | Phone and laptop |
| Gate scanner | Staff at the gate or a kiosk | Scan ID cards as students arrive | Phone or tablet |
| Parent / guardian | Often on a basic Android phone, may have low literacy and no email | Is my child at school? How are they doing? What do I owe? | Phone |
| Student | Primary to Grade 12 | Timetable, assignments, results, attendance | Phone |

## 4. Scope

### 4.1 In scope for the remodel

| Module | What the user gets | State today |
|---|---|---|
| Accounts and access | Sign in per school, roles and permissions, password reset by admin, first-login password change | Works, hardened in Phase 0; needs a single session design |
| Schools (platform) | Create a school with its first admin, branding, activate or suspend, plan | Works (wizard); plans are three loose columns |
| School year setup | One guided flow: year, semesters and periods, grade levels, sections, classes, sponsors, subjects | Spread over 10 pages |
| Students and enrollment | Admission, enrollment, transfer, promotion, graduation, ID cards | Works, but two enrollment tables and scattered pages |
| Attendance | School-day attendance by QR scan or sponsor, excuses with documents, auto-absent, reports | Done and tested (implementation guide §6) |
| Grades and report cards | One gradebook per class and subject, grading schemas, publish results, report cards, remedial | Six overlapping pages |
| Fees | Fee schedules, invoices per student, payments with receipts, arrears, reports | Partial; no receipts, currency or discounts |
| Parent portal | Child switcher, attendance, results and report cards, fees and receipts, messages | Attendance only |
| Communication | Announcements, notices to parents by SMS or WhatsApp, in-app messages | Partial; no working notification inbox |
| Audit | Who created, changed or deleted what, per school; platform-wide view for operators | Done (Oct 2026) |

### 4.2 Out of scope for this remodel

- Transport, cafeteria and health modules (their menu links are removed until built).
- Native mobile apps (the web app becomes an installable PWA instead).
- Online payment gateways (record payments made in cash, bank or mobile money first; integrate later).
- Learning management (course content, quizzes).

## 5. Requirements by module

Priorities: **P0** must ship in the remodel, **P1** should, **P2** later.

### 5.1 Accounts and access
- P0: Every page and API requires a session, except login and the public school lookup.
- P0: A user belongs to one school and can only act inside it. Platform operators act on one chosen school at a time, and that choice is audited.
- P0: Admins reset a user's password and hand it over in person; the user must change it at first login (enforced by the server, not only the UI).
- P0: Lock an account for 15 minutes after 5 failed sign-ins.
- P1: Sign in with phone number as well as email (many parents have no email).
- Out of scope: one login across schools. Decided: one account per school.

### 5.2 School year setup
- P0: A "Start a new school year" wizard that creates, in order: the year with its semesters and periods, grade levels and sections, classes with sponsors, and class subjects with teachers. Each step can create what is missing inline.
- P0: Copy last year's structure (levels, sections, subjects, sponsors) as a starting point.
- P1: A setup checklist on the admin home that shows what is missing and links straight to the fix.

### 5.3 Students and enrollment
- P0: Admit a student (with guardian) and enroll them in a class in one form.
- P0: Bulk import from a spreadsheet, with a preview showing errors per row before anything is saved.
- P0: Promote, repeat, transfer and graduate at year end, class by class, with the system's recommendation from grades and attendance.
- P0: Admission numbers unique within the school, in the school's format.
- P1: Archive instead of delete for anyone with history.

### 5.4 Attendance
Done. Keep: QR ID cards, gate scanning, sponsor marking, excuses with documents, auto-absent after the cut-off, overview and reports. Open items:
- P1: Offline scan queue for gates with poor connectivity.
- P1: Absence alerts to parents in the app (SMS on hold, see §5.8).

### 5.5 Grades and report cards
- P0: One gradebook per class and subject: columns are assessments (tests, assignments, exams), rows are students; totals use the school's grading schema.
- P0: Sponsors and admins review, then publish results per period; students and parents see only published results.
- P0: Report cards per period and semester, printable on A4, with the school's logo, name and seal, attendance, and the class sponsor's and principal's signatures (uploaded once by each person, fixed when results are published). Written remarks are filled in by hand for now.
- P1: Remedial plans for failing students that feed promotion decisions.

### 5.6 Fees
- P0: Fee schedules per grade level and term; invoices generated per enrolled student.
- P0: Record a payment (cash, bank, mobile money) with a numbered receipt and who received it; a printable receipt.
- P0: Balances calculated from invoices and payments, never typed in.
- P0: Arrears list per class, and a collection report.
- P1: Discounts and scholarships; refunds and voids with a reason.
- P0: Two currencies, USD and LRD. Each fee schedule has an amount in both. A student's first payment in a school year sets the currency for that student's fees for the rest of the year; every later installment must be in that currency. Another student in the same school can pay in the other currency.

### 5.7 Parent portal
- P0: A parent sees only their linked children, with a child switcher.
- P0: Today's attendance and history, report an absence (done); published results and report cards; fee balance and receipts.
- P0: Works well on a small Android phone over a slow connection.
- P1: In-app alerts for absence, published results and payment received; email copies for families with an email address.

### 5.8 Communication
- P0: School announcements to everyone, a role, a class or one family.
- P0: An in-app notification inbox; every alert lands here.
- P1: Email copies at no cost, with a delivery log and per-family preferences.
- On hold: SMS. The sending layer and delivery log are built so SMS (school Android phone or a paid provider sold as credits) can be switched on later without rework.

### 5.9 Platform (operator)
- P0: Create a school with its first admin (existing wizard), suspend or reactivate, branding.
- P0: Platform audit log; school audit logs never show operator actions to schools.
- P1: Plans, subscriptions and invoices for schools; feature switches per plan.
- P2: Usage metrics and churn signals (prototype exists).

## 6. Non-functional requirements (summary)

Full detail is in the [technical requirements](02-technical-requirements.md).

- **Isolation:** no request can read or change another school's data; this is enforced in code and by the database.
- **Performance:** key phone pages (attendance roster, parent home, scan) usable within 3 seconds on a 3G connection; first load under 300 KB of JavaScript for those pages.
- **Availability:** 99.5% monthly during school hours (07:00–17:00 Africa/Monrovia).
- **Data safety:** daily backups kept 30 days; a restore tested every term.
- **Privacy:** children's personal data is visible only to staff who need it and to their guardians; health and religion fields are optional and restricted.
- **Accessibility:** WCAG 2.1 AA for colour contrast, keyboard use and form labels.

## 7. Success measures

| Measure | Target by end of first term after launch |
|---|---|
| Attendance captured on school days | ≥ 95% of enrolled students have a record by 12:00 |
| Time to set up a new school year | Under 1 hour for a school with 12 classes |
| Report card turnaround | Published within 7 days after the period closes |
| Parent adoption | ≥ 50% of families have at least one active guardian login |
| Fee collection visibility | 100% of payments recorded with a receipt number |
| Support load | Fewer than 2 "how do I" requests per school per week |
| Security | Zero cross-school access in the automated isolation test suite, on every release |

## 8. Commercial model

**Decided:** schools pay a fee per user, not per student. The goal is a price low enough that going digital is the obvious choice.

**Decided (Oct 2026)**, except prices, which are set after the pilot:

| Rule | Decision | Why |
|---|---|---|
| Staff accounts | Billed while the account exists and is active | Staff run the school in the app; their count is small and predictable |
| Parent and student accounts | Billed only in months they sign in | Schools aren't punished for creating accounts for every family, which is what drives digital use |
| Billing cycle | Per term (semester), invoiced at the start of each term | Matches when schools collect their own fees |
| School holidays | Not billed | Schools pay for months they teach |
| Minimum | A small term minimum per school | Covers hosting for tiny schools |
| Currency | USD or LRD; the school's first payment on a term invoice fixes that invoice's currency | Same idea as student fees |
| Pilot | First term free for new schools | Removes the risk of trying it |

Prices are set after the pilot, aiming for a small share of the fees a school collects per student.

**Non-payment** (automatic, each step shown to the admin in the app with the amount due):

1. Invoice issued; reminders on the due date and 7 and 14 days after.
2. 30 days overdue: **read-only**. Everyone can sign in and view and print, but nothing new can be created or changed. Parents keep seeing results and balances, so the school, not the families, feels the pressure.
3. 60 days overdue: **suspended**. Only the school admin can sign in, to pay or export data.
4. Data is never deleted for non-payment without written notice; a full export (students, results, payments) stays available. Paying restores access immediately.

**If a school goes back to paper:** no technical measure stops that, and holding their data hostage would harm trust. Instead: give them their data on request; keep the account dormant and free for a year so they can come back with history intact; make the paper outputs (report cards, receipts, class lists) come from the app so going back means more work, not less.

The platform currently stores a plan type, amount and status on the school record only. The schema plan adds plans, subscriptions, a usage count per school and the access states (active, read-only, suspended, dormant).

## 9. Constraints and assumptions

- Calendar: two semesters of three periods each per year (Liberian system); the time zone is Africa/Monrovia.
- Grade levels from Kindergarten to Grade 12; WAEC/WASSCE results may be recorded later.
- Hosting moves from Render to Railway; no persistent disk is assumed, so files go to object storage.
- Many families share phones and have no email, so phone-based login and SMS matter more than email.

## 10. Risks

| Risk | Mitigation |
|---|---|
| Regressions while rebuilding pages | Rebuild area by area behind the new navigation; keep tests per module; the isolation suite gates every release |
| Schools resist workflow changes | Keep terms and printed outputs (report cards, receipts) familiar; pilot with one school per phase |
| Unreliable connectivity at gates | Offline scan queue (P1) |
| Families not opening the app | In-app alerts first; SMS kept ready to switch on when a school wants it |
