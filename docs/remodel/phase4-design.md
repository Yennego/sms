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
