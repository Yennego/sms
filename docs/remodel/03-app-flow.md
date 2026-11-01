# App flow

How the app is organised after the remodel: URLs, navigation per role, and the main journeys. It replaces today's 137 pages (many duplicated) with one canonical page per job.

## 1. URL scheme

```
/                          Landing: find your school
/{school}/login            School sign-in (branding from the public school lookup)
/{school}                  Home for the signed-in role
/{school}/{area}/...       Area pages, e.g. /top-foundation/students/123
/platform/...              Platform operator (today /super-admin)
/platform/login            Operator sign-in
```

Rules:

- `{school}` is always the school's slug (its domain, e.g. `top-foundation`), never its UUID. Links built from UUIDs are removed.
- Slugs can't take reserved words: `login`, `platform`, `super-admin`, `api`, `static`, `students`, `teachers`, `settings`, and the other area names.
- Sub-pages use tabs in the URL (`?tab=sections`) instead of separate routes where they edit the same object.
- Delete the legacy `(dashboard)/` tree, root `admin-dashboard`, the empty pages and redirect-only pages (moved to `next.config` redirects).

## 2. Navigation per role

At most 7 items per role, one level deep. Settings sit in the user menu, not the main list. On phones the navigation is a bottom bar (up to 5 items) plus a "More" sheet.

| Role | Navigation |
|---|---|
| School admin, principal | Home · Students · Staff · Classes · Attendance · Grades · Fees |
| Registrar | Home · Students · Classes · Attendance |
| Bursar / accountant | Home · Fees · Students (read-only) |
| Teacher (sponsor and/or subject) | Home · My classes · Attendance · Gradebook · Timetable |
| Gate scanner | Scan (full screen, no menu) |
| Parent | Home · Attendance · Results · Fees · Messages (child switcher in the header) |
| Student | Home · Timetable · Assignments · Results · Attendance |
| Platform operator | Schools · Users · Plans & billing · Audit · System |

User menu (all roles): Profile, Change password, Notification preferences, Sign out. Admins also get **School settings** (school profile, users and roles, grading schemas, attendance rules, messaging, audit log).

The navigation comes from one role→menu config shared by the sidebar, the post-login redirect and the home page, so they can't disagree. (Today they do: the scanner role never matched its menu.)

## 3. Areas and their pages

| Area | Pages (tabs in brackets) | Replaces today |
|---|---|---|
| Home | Role dashboard: today's attendance, alerts, setup checklist (admin) | `dashboard`, `admin-dashboard`, root `admin-dashboard` |
| Students | Directory · Student profile (overview, enrollment, attendance, results, fees, guardians, ID card) · Admit · Import · Year-end (promote/graduate) | `students/*`, `academics/enrollments`, `student-assignments`, `promotion`, `remedial`, `(dashboard)/students/*` |
| Staff | Directory · Staff profile (classes, subjects, sponsor of) · Add · Assignments | `teachers/*`, `academics/teacher-assignments`, `(dashboard)/teacher*` |
| Classes | Year setup wizard · Classes list · Class page (roster, subjects & teachers, timetable, sponsor) · Structure (years and terms, grade levels, sections, subjects) | `classes/*`, `academics/classes`, `academics/grades` (levels), `sections`, `subjects`, `semesters`, `academic-years`, `timetables`, `setup` |
| Attendance | Today · Mark (class roster) · Scan · Excuses · Reports · ID cards | Already consolidated in Phase 2–4; drop `academics/attendance` (period) from navigation |
| Grades | Gradebook (class × subject) · Assessments · Publish · Report cards · Remedial | `grading-hub`, `gradebook`, `assessments`, `assignments`, `exams`, `grades/publish`, `report-cards` |
| Fees | Overview · Invoices · Record payment · Arrears · Fee setup (categories, schedules) · Expenses | `finance/*` and its separate sub-nav |
| Messages | Announcements · Send notice · Delivery log | `communication/*` (mostly missing pages) |
| School settings | School profile · Users & roles · Grading schemas · Attendance rules · Messaging · Audit log | `settings/*`, `admin/roles`, `admin/permissions`, `admin/role-assignment` |

## 4. Key journeys

### 4.1 Sign in

1. Parent opens `/{school}/login` (shared link or QR on a school notice). The page shows the school's logo and name.
2. Enters phone or email and password.
3. First login with an admin-issued password: the only page available is **Set your password**.
4. Lands on their role's home.

Errors say what to do: "Wrong password. After 5 tries the account locks for 15 minutes." Session expiry returns the user to the same school's login and back to the page they were on.

### 4.2 Admin starts a new school year (wizard)

One page, five steps, progress saved after each step. Each step can create what is missing without leaving the wizard.

1. **Year:** name, dates; semesters and periods prefilled (2 × 3) and editable. Option: copy last year's structure.
2. **Levels and sections:** grade levels K–12 with their sections (A, B, ...). Prefilled from last year.
3. **Classes and sponsors:** one class per level and section; pick the sponsor from staff (or add a teacher inline).
4. **Subjects and teachers:** subjects per level, teacher per class subject (bulk assign per level).
5. **Enroll students:** carry over promoted students, add new admissions, or import a spreadsheet. Shows counts per class.

Done screen: what was created, and the remaining checklist (grading schema, fee schedules, ID cards).

### 4.3 Admit and enroll a student

Students → Admit: one form with student details, guardian (find existing or create, with phone), class for the current year. Save creates the student, the guardian login (password shown once to hand over) and the enrollment together, or nothing if any part fails.

### 4.4 Teacher's day (phone)

1. Home shows "My class today": present / late / absent / not marked, and a **Mark attendance** button (sponsors).
2. Mark: roster with one-tap status; scanned students are already present; excuse with photo of a note.
3. My classes → class → Gradebook: enter marks per assessment; totals update live; **Submit for review**.

### 4.5 Gate scanning

Scanner opens the app on a phone at the gate: a full-screen camera. Each scan shows the student's photo, name and class with a green (present), amber (late) or red (rejected, with the reason). Typing an admission number works when a card is lost.

### 4.6 Publish results and report cards

1. Grades → Publish: per class and period, see which subjects are complete.
2. Principal reviews and publishes.
3. Report cards: print per class (A4), or parents view them in the portal.

### 4.7 Record a fee payment

Fees → Record payment: find student, see balance and open invoices, enter amount, method (cash, bank, mobile money) and reference. Save issues a receipt number and opens a printable receipt. The parent's portal shows the payment.

### 4.8 Parent checks on a child

Home: child switcher, then today's status (present, late, absent, not yet marked), latest published results, fee balance, and alerts such as "Absent without excuse on 2 days: report a reason". Each card links to its area.

### 4.9 Platform operator onboards a school

Schools → New school: the existing three-step wizard (school details and slug, first admin, credentials and login URL), plus plan and features as a fourth step. The school appears in the list with its setup progress.

## 5. Error and empty states

- Missing prerequisite: say what is missing and link to fix it ("No sections for Grade 3 yet. [Add sections]").
- Permission denied: "Your role can't do this. Ask your school administrator." No raw status codes.
- Empty lists: one sentence of what goes here and the primary action button.
- Offline: banner "You're offline. Changes will be sent when you reconnect" (scan queue first, then attendance marking).
