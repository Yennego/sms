# Phase 4 design: grades and report cards

Replaces today's grading, which has three assessment tables, a marks table without a real
link to its assessment, three publish flags that disagree, category weights that are never
applied, and no checks on who may enter marks (see the October 2026 review).

## 1. Decisions (October 2026)

- **Period grade** for a subject = weighted categories. The school's grading schema has
  categories with weights adding up to 100 (e.g. Tests 40, Assignments 30, Quizzes 20,
  Participation 10). Each category's score is the **average percentage** of its assessments in
  that period; the period grade is the weighted sum. Categories with no assessments in the period
  are left out and the remaining weights are scaled up to 100.
- **Semester average** = (Period 1 + Period 2 + Period 3 + Semester exam) ÷ 4. Each semester has
  three periods and one exam. If a column is missing, the average uses the columns that exist and
  is marked **incomplete**.
- **Yearly average** = mean of the two semester averages.
- **Pass mark** = 70 by default, set per school; a grade level can override it through its
  promotion criteria. A subject is passed when its yearly average ≥ pass mark.
- Scores: `score` between 0 and the assessment's `max_score`; an entry can be **excused** (left
  out of averages) or **absent** (counts as 0). Results are shown rounded to whole numbers;
  stored and computed with full precision.

### Confirmed by the school owner (October 2026)
- Teachers see unpublished marks only for the class subjects they teach and the classes they
  sponsor (the teacher role no longer has `view_academic_data`).
- The one pre-Phase-4 "EXAM"-type assessment became a period test under the Exam category; the
  semester exam is its own report-card column.
- Report cards label periods 1st–6th (Liberian paper style). Period names are school data, so a
  school that wants other labels can rename its periods; showing the period's own name on the card
  is a small follow-up.
- Written remarks stay blank lines filled in by hand for now.

## 2. Data model

New and changed tables (one migration; existing data is small and is moved across):

### `assessments` (extended; the single table for every gradable activity)
| Column | Notes |
|---|---|
| `tenant_id`, `id` | |
| `class_subject_id` | **required**, FK `(tenant_id, class_subject_id) → class_subjects`; gives class, subject and the teacher allowed to grade |
| `kind` | `test`, `quiz`, `assignment`, `project`, `participation`, `exam`, `other` |
| `period_id` | FK periods; required for every kind except `exam` |
| `semester_id` | FK semesters; required for `exam` (the semester exam), null otherwise |
| `grading_category_id` | FK grading_categories; required for period kinds (decides the weight), null for `exam` |
| `title`, `description`, `assessment_date`, `due_date`, `max_score` (> 0) | |
| `created_by` | user |

Unique: one `exam` per class subject and semester.
Legacy columns (`type`, `teacher_id`, `grade_id`, `section_id`, `class_id`, `academic_year_id`,
`is_published`) stay until the old pages are gone, filled from `class_subject_id`.

### `score_entries` (replaces `grades` as the mark table)
`tenant_id, id, assessment_id (FK, ON DELETE CASCADE), student_id, enrollment_id, score
(numeric, null when excused/absent), status ('scored' | 'absent' | 'excused'), comment,
entered_by, entered_at, updated_at`. **Unique (assessment_id, student_id).**

### `result_publications`
`tenant_id, id, class_id, period_id (nullable), semester_id (nullable), published_at,
published_by`. Exactly one of `period_id` / `semester_id` (semester = the exam column and
semester average). Unique per (class, period) and per (class, semester). Deleting the row
unpublishes.

### `grading_settings`
`tenant_id (unique), pass_mark (int, default 70), updated_at`. One row per school.

### Data migration
- `exams` and `assignments` rows → `assessments` (kind `exam` / `assignment`), matched to their
  class subject by year, grade, section and subject; rows that can't be matched are reported and
  skipped.
- `grades` rows → `score_entries` where the assessment can be found; others reported.
- `Period.is_published = true` → a `result_publications` row for every class of that year.
- Old tables (`grades`, `exams`) and columns stay read-only until the cleanup step; nothing new
  writes to them. `assignments` + `submissions` stay for student homework hand-in, not grading.
- Promotion statuses saved as "Repeating" with the note "No grades recorded" are deleted (they
  were never real decisions).
- As built (migration `f6c2a9d4b8e3`): existing `assessments` rows keep their id and get their
  period from their marks' `period_id` (else by date) and a category by name when missing; an old
  `assessments` row of type EXAM sits inside a period with a category, so it becomes kind `test`
  (not the semester exam). Exams/assignments keep their ids as assessment ids. Rows that can't be
  placed are copied to `assessments_unmigrated` (RLS on) instead of being lost. A semester
  publication is migrated only when all its periods are published.

RLS: new tables get the `tenant_isolation` policy; composite tenant keys like the baseline.

## 3. Who can do what

| Action | Allowed |
|---|---|
| Create/edit/delete an assessment, enter scores | the class subject's teacher, or a user with `manage_academic_data` |
| See a class's marks (unpublished) | the class subject's teacher, the class sponsor, users with `view_academic_data` |
| Publish / unpublish results | `publish_results` (new; given to admin and academic-admin) |
| Change pass mark | `manage_academic_data` |
| See own results | student: only **published** periods/semesters of their own enrollments |
| See a child's results | parent linked to the student: published only |

Changing scores of a published period is allowed for admins only (`manage_academic_data`) and is
recorded in the audit log; teachers get 409 "Results for this period are published. Ask the
principal to unpublish them first." The same rule covers creating, editing and deleting
assessments in a published period (or the exam of a published semester).

Role mapping (migration): `publish_results` goes to the `admin` and `academic-admin` system roles.
The `teacher` system role loses `view_academic_data` (nothing used it before; with it every teacher
could read every class's unpublished marks), so teachers see only the class subjects they teach
and the classes they sponsor. Students/parents are recognised by identity (the student themself,
a parent linked through `parent_student`), not by role name.

## 4. API (`/api/v1/academics/gradebook`)

### Assessments
- `GET /assessments?class_subject_id&period_id|semester_id` → list with `entered` (scores
  entered) and `students` (class size).
- `POST /assessments` `{class_subject_id, kind, period_id|semester_id, grading_category_id,
  title, description?, assessment_date?, due_date?, max_score}`.
- `PUT /assessments/{id}` (same fields except class subject); `DELETE /assessments/{id}`
  (refused with 409 if scores exist unless `?force=true` by an admin).

### Scores
- `GET /sheet?class_subject_id&period_id` (or `&semester_id` for the exam) → the grid:
  ```json
  {"class": {...}, "subject": {...}, "period": {...}, "published": false,
   "categories": [{"id","name","weight"}],
   "assessments": [{"id","title","kind","max_score","grading_category_id","assessment_date"}],
   "students": [{"student_id","name","admission_number",
                 "scores": {"<assessment_id>": {"score": 18, "status": "scored", "comment": null}},
                 "period_score": 84.5, "complete": true}],
   "class_average": 76.2}
  ```
- `PUT /assessments/{id}/scores` `{"entries": [{"student_id","score"|null,"status","comment"?}]}`
  → upsert; validates every student is enrolled in the class this year and `0 ≤ score ≤
  max_score`; all or nothing; returns the updated sheet rows.

### Review and publish
- `GET /classes/{class_id}/progress?period_id|semester_id` → per subject: teacher, assessments
  count, students with a period score / class size, class average, published flag.
- `POST /publications` `{class_id, period_id|semester_id}`; `DELETE
  /publications?class_id&period_id|semester_id`. Publishing a semester requires all three of its
  periods published (409 otherwise).
- `GET /publications?academic_year_id` → what's published per class.

### Results and report cards
- `GET /report-cards/students/{student_id}?academic_year_id` → one report card:
  ```json
  {"student": {...}, "class": {...}, "year": {...}, "pass_mark": 70,
   "subjects": [{"subject_id","name",
     "semesters": [{"number": 1, "periods": [84, 79, null], "exam": 70, "average": 77.7, "complete": false}, ...],
     "yearly_average": 77.7, "passed": true}],
   "overall": {"semester_averages": [78.1, null], "yearly_average": 78.1, "rank": 5, "class_size": 32},
   "attendance": {"present": 80, "absent": 3, "late": 2, "excused": 1},
   "remarks": {"sponsor": null}}
  ```
  Students and parents get only published columns (unpublished ones are `null` and the semester
  average/rank hidden until the semester is published); staff see everything, with a
  `published` flag per column.
- `GET /report-cards/classes/{class_id}?academic_year_id` → the list above for every enrolled
  student (for printing a class).
- `GET /settings` / `PUT /settings` `{pass_mark}`.

Promotion (`/promotions/evaluate`) and remedial switch to these results: a subject fails when its
yearly average < pass mark; a student with no published results is "Not graded".

### As built (shapes the frontend reads)
Numbers are sent at full precision rounded to 2 decimals; screens round to whole numbers (half up).
`passed` compares the unrounded yearly average with the pass mark.

- `GET /class-subjects?academic_year_id` (default current year) → `[{class_subject_id, class_id,
  class_name, subject_id, subject_name, teacher_id, teacher_name, can_edit}]`: staff with
  `view_academic_data`/`manage_academic_data`/`publish_results` see all; a teacher sees the class
  subjects they teach plus every subject of classes they sponsor (`can_edit` false for those they
  don't teach).
- `GET /assessments` items: `{id, class_subject_id, kind, title, description, period_id,
  semester_id, grading_category_id, assessment_date, due_date, max_score, created_by, entered,
  students}`. `POST` returns 201 with the same object.
- `DELETE /assessments/{id}`: 409 `{message, scores}` when marks exist unless `?force=true`; force is
  allowed for the class subject's teacher while the period isn't published, and for
  `manage_academic_data` always (audited when published). Returns `{deleted, scores_deleted}`.
- `GET /sheet` also has `class_subject_id`, `teacher {id, name}` (or null), `semester {id, name,
  number}` (the period's semester, or the exam's), `period` null for the exam sheet, `can_edit`
  (may change scores/assessments now: false for viewers and for teachers once published),
  `can_manage` (holds `manage_academic_data`). For the exam sheet `categories` is empty and
  `period_score` is the exam percentage. Category order: weight descending.
- `PUT /assessments/{id}/scores`: `status` defaults to `scored`; `{student_id, score: null, status:
  "scored"}` deletes that student's entry; for absent/excused any score is ignored. Errors: 422
  `{"detail": {"message": "No scores were saved.", "problems": [{student_id, error}]}}`. Success:
  `{"students": [sheet rows of the students sent], "class_average"}`.
- `GET /classes/{class_id}/progress` → `{class_id, class_name, class_size, published, subjects:
  [{class_subject_id, subject_id, subject_name, teacher_name, assessments, scored, students,
  class_average, published}]}`; with `semester_id` the numbers are about the exam column. Readers:
  sponsor, `view_academic_data`, `manage_academic_data`, `publish_results`.
- Publication rows: `{id, class_id, period_id, semester_id, published_at, published_by,
  published_by_name}`. `POST` is idempotent (201, returns the row); publishing a semester before
  all its periods → 409 `{message, missing_periods}`; unpublishing a period of a published
  semester → 409. `GET /publications` is for staff and teachers.
- Report card: `student {id, name, first_name, last_name, admission_number}`, `class {id, name,
  sponsor_name}`, `year {id, name}`, `remarks {sponsor, principal}` (null for now), plus
  `published_only` and `semesters: [{id, number, name, published, periods: [{id, number, name,
  published}]}]` (column headings). Each subject also has `teacher_name`; for staff each
  `semesters[]` item has `published: {periods: [bool, ...], exam: bool}` (exam covers the exam and
  the semester average); student/parent responses omit it. `overall.rank` is the yearly rank in
  the class (1, 2, 2, 4), on published columns for students/parents and all columns for staff;
  null without a yearly average. `class_size` counts the class's enrollments that didn't leave.
- `GET /report-cards/classes/{class_id}` → `{"items": [card, ...]}` sorted by name (staff and the
  sponsor only).
- `GET /settings` → `{pass_mark, updated_at}` (anyone in the school); `PUT` needs
  `manage_academic_data`. A grade level's promotion criteria `passing_mark` overrides it.

Retired with this phase: `/academics/grades*` (including `/academics/students/{id}/academic-history`)
and the old `/academics/assessments` CRUD.

## 5. Screens

| Screen | Path | Notes |
|---|---|---|
| Gradebook | `/{school}/academics/gradebook` | pick class → subject → period (or exam); grid of students × assessments; type scores (Tab/Enter moves down), period score updates after save; add/edit assessment column; phone: one assessment at a time, list of students with big inputs |
| Review and publish | `/{school}/academics/grades/publish` | per class and period: subjects complete or not, class averages; Publish/Unpublish with confirmation |
| Report cards | `/{school}/academics/report-cards` | pick class (and student); A4 print layout per student, print all for a class |
| Grading settings | `/{school}/academics/grading-schemas` | categories and weights (existing) + pass mark |
| My results (student) | `/{school}/student/grades` | published results only |
| Child results (parent) | `/{school}/parent/results` | child switcher, published results |

The Grades area tabs become: Gradebook · Review and publish · Report cards · Grading settings ·
Remedial. Old pages (`grading-hub`, `assessments`, `exams`, `assignments` grading, period
toggles) redirect to the gradebook.

## 6. Signatures, seal and school profile on report cards (added October 2026)

Report cards carry the school's identity and the signatures of the class sponsor and the
principal, as paper cards do.

### Decisions
- **A signature belongs to the person**, not to a report card: each staff member uploads theirs
  once (Profile → My signature) — a photo or scan, or drawn with a finger on a phone. Only the
  owner can set or remove it.
- **The school names its principal** in a School profile (who, and the title printed under the
  signature: "Principal", "Headmaster", …), with address, motto, phone, email and an optional
  **school seal** image. Logo and name stay on the school record.
- **Signatures are fixed at publication.** Publishing a class's results records the sponsor's and
  the principal's signature *in use at that moment* on the publication. A published report card
  shows the signatures of its latest publication; later changes (new principal, new signature)
  don't alter cards already published. Unpublished previews (staff) show "Signature appears when
  results are published".
- **Signatures are never public files.** They are stored privately (in the database until object
  storage arrives, Phase 6) and only returned inside a report card to someone allowed to see it.
  Each upload is kept as a version (older versions stay valid for cards already published).

### Data
- `user_signatures (tenant_id, id, user_id, image (PNG, normalised), width, height, sha256,
  created_at, is_current)` — one current per user; old versions kept.
- `school_profiles (tenant_id unique, address, motto, phone, email, principal_user_id,
  principal_title default 'Principal', seal_image (PNG, nullable), updated_at)`.
- `result_publications` gains `sponsor_user_id`, `sponsor_signature_id`, `principal_user_id`,
  `principal_signature_id` (all nullable: a missing signature prints a blank line).

### Upload rules
PNG or JPEG, at most 1 MB uploaded; the server checks the real file type, strips metadata,
converts to PNG, trims empty margins and scales to at most 600×200 px (seal: 400×400). A drawn
signature is sent as a PNG.

### API
- `GET /api/v1/auth/me/signature` → `{has_signature, image (data URL), updated_at}`;
  `PUT` (multipart `file`); `DELETE`.
- `GET /api/v1/tenants/self/profile` / `PUT` (permission `manage_tenant_settings`): address,
  motto, phone, email, principal_user_id, principal_title; `PUT /tenants/self/profile/seal`
  (multipart) / `DELETE`.
- Report card responses gain:
  ```json
  "school": {"name", "logo", "address", "motto", "phone", "email", "seal"},
  "signatures": {"sponsor": {"name", "title": "Class sponsor", "image"} | null,
                 "principal": {"name", "title", "image"} | null}
  ```
  (images as data URLs; `null` when not yet published or no signature on file).

### As built (October 2026, migration `e7d2c4a9b1f6`)
- Upload errors: 413 `{"detail": "The image is larger than 1 MB."}`; 422 with a message for
  anything that isn't a decodable PNG/JPEG (GIF, WebP, SVG, PDF, text renamed `.png`, truncated
  files), an empty/blank image, or more than 25 million pixels. The file name and declared
  content type are ignored. JPEG orientation is applied; all metadata is dropped. Signatures:
  near-white and transparent margins trimmed (4 px kept); seal: transparent margins trimmed.
  Images are only shrunk, never enlarged.
- `GET/PUT/DELETE /auth/me/signature` → `{has_signature, image, updated_at}` (`DELETE` returns
  the same shape with `has_signature: false`). Students and parents get 403. Uploading the same
  picture again doesn't create a new version.
- `GET /tenants/self/profile` also needs `manage_tenant_settings` and returns `{address, motto,
  phone, email, principal_user_id, principal_name, principal_title, principal_has_signature,
  seal, updated_at}`; `PUT` takes any subset of the fields (null or "" clears one; a blank title
  becomes "Principal"); `PUT/DELETE /seal` return the profile. The principal must be an active
  staff user (not a student or parent) of the school, otherwise 422.
- On publish, the sponsor is the class sponsor shown on the card (`classes.class_teacher_id`,
  else the section's sponsor). Re-posting an existing publication doesn't take a new snapshot.
  The card uses the class's latest publication (`published_at`); the principal's *title* is read
  from the current profile (only the people and signatures are fixed). Unpublishing the latest
  column falls back to the previous publication's signatures.
- `school.logo` is the tenant's `logo` URL; `school` and `signatures` are repeated on every card
  of `GET /report-cards/classes/{id}`.
- Deleting a user removes their signatures and clears only that column on publications and
  profiles. Signature and seal uploads are written to the audit log without their bodies.

## 7. Report card verification QR (added October 2026)

A printed report card carries a QR code. Anyone (another school, an employer, a parent) can scan
it to check the card is genuine and unchanged; a forged or edited paper copy won't match.

### Decisions
- **One verification record per issued report card**: when a report card with published results
  is produced for a student and year, the server stores a snapshot of what it shows (subject
  averages per published column, semester and yearly averages, rank, pass/fail) and a random,
  unguessable code (128-bit, URL-safe). The same snapshot reuses the same code; if the published
  results change (a correction after unpublishing), a new record is made and the old one shows as
  **superseded**.
- **The QR encodes** `{FRONTEND_URL}/verify/{code}`; the card also prints the code in short form
  for typing.
- **The public check page** (`/verify/{code}`, no sign-in) shows: school name and logo, student
  full name, admission number, class, school year, issue date, and the snapshot's averages, with a
  clear status — "Valid", "Superseded by a newer report card issued on …", or "Not found". It shows
  nothing else about the student (no contact details, no attendance, no other years).
- Only published results are ever snapshotted; drafts never get a code.
- The public endpoint is rate-limited (per IP), returns the same "Not found" for unknown and
  malformed codes, and is in `PUBLIC_ROUTES`.

### Data and API
- `report_card_verifications (tenant_id, id, code (unique), student_id, academic_year_id,
  snapshot JSONB, snapshot_hash, issued_at, superseded_at)`.
- Report card responses (student and class, when anything is published) gain
  `"verification": {"code", "url", "qr_svg"}`.
- `GET /api/v1/verify/report-cards/{code}` (public) →
  `{"status": "valid"|"superseded"|"not_found", "school": {"name","logo"}, "student": {"name",
  "admission_number"}, "class_name", "year_name", "issued_at", "superseded_at", "subjects":
  [{"name","semester_averages","yearly_average","passed"}], "overall": {...}}`.
- `verify` is a reserved slug.
