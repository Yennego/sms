# Phase 3 API contract

New endpoints for the year setup wizard, admissions and import (see 03-app-flow.md §4.2–4.3).
All are under `/api/v1`, need a session, act on the caller's school, and follow the unit of work
(one commit per request). Errors use `{"detail": "..."}` with plain words saying what to fix.
Dates are ISO `YYYY-MM-DD`; ids are UUID strings.

## 1. Year setup: `/academics/year-setup` (permission `manage_academic_year`)

### `GET /academics/year-setup/{year_id}`
Everything the wizard shows for one school year. Each step is `complete` when:
terms = at least one semester with periods; levels = at least one grade level with a section;
classes = every (level, section) has a class this year and every class has a sponsor;
subjects = every class has at least one subject and every class subject has a teacher;
enrollment = at least one student enrolled.

```json
{
  "year": {"id": "…", "name": "2026/2027", "start_date": "2026-09-01", "end_date": "2027-07-15", "is_current": true},
  "previous_year": {"id": "…", "name": "2025/2026"} ,
  "steps": {
    "terms": {"complete": true, "semesters": [
      {"id": "…", "name": "Semester 1", "number": 1, "start_date": "…", "end_date": "…",
       "periods": [{"id": "…", "name": "Period 1", "number": 1, "start_date": "…", "end_date": "…"}]}
    ]},
    "levels": {"complete": true, "levels": [
      {"id": "…", "name": "Grade 1", "sequence": 1, "sections": [{"id": "…", "name": "A", "capacity": 30}]}
    ]},
    "classes": {"complete": false,
      "classes": [{"id": "…", "name": "Grade 1 - A", "grade_id": "…", "grade_name": "Grade 1", "section_id": "…",
                   "section_name": "A", "sponsor_id": "…", "sponsor_name": "Ama Kollie", "enrolled": 24, "capacity": 30}],
      "missing": [{"grade_id": "…", "grade_name": "Grade 2", "section_id": "…", "section_name": "B"}]},
    "subjects": {"complete": false, "unassigned_teachers": 3, "classes": [
      {"class_id": "…", "class_name": "Grade 1 - A", "grade_id": "…", "grade_name": "Grade 1", "subjects": [
        {"class_subject_id": "…", "subject_id": "…", "subject_name": "Mathematics", "teacher_id": null, "teacher_name": null}
      ]}
    ]},
    "enrollment": {"complete": true, "total": 312, "per_class": [{"class_id": "…", "class_name": "Grade 1 - A", "count": 24, "capacity": 30}]}
  }
}
```
`previous_year` is the latest other year that starts before this one, or `null`.

### `POST /academics/year-setup/{year_id}/terms/default`
Creates 2 semesters × 3 periods splitting the year's dates evenly. 409 if the year already has
semesters. Returns the `terms` step object.

### `POST /academics/year-setup/{year_id}/copy-from/{source_year_id}`
Body `{"terms": true, "classes": true, "sponsors": true, "subjects": true}` (all default true).
Copies from the source year whatever this year doesn't have yet: semesters and periods (dates
shifted by the difference between the years' start dates), one class per source class (same
level and section), sponsors, class subjects and their teachers. Never overwrites. Returns
`{"semesters": n, "periods": n, "classes": n, "sponsors": n, "class_subjects": n}` (counts created).

### `POST /academics/year-setup/{year_id}/classes/generate`
Body `{"grade_ids": ["…"]}` (optional; default all levels). Creates the missing classes (name
"<level> - <section>", capacity from the section). Returns the `classes` step object.

### `PUT /academics/year-setup/classes/{class_id}/sponsor`
Body `{"teacher_id": "…" | null}`. Returns the class row as in `classes.classes[]`.

### `POST /academics/year-setup/{year_id}/subjects`
Body `{"grade_id": "…", "subject_ids": ["…"], "teachers": {"<subject_id>": "<teacher_id>"}}`.
For every class of that level this year: adds the subjects it lacks and sets the given teachers.
Returns the `subjects` step object.

### `PUT /academics/year-setup/class-subjects/{class_subject_id}/teacher`
Body `{"teacher_id": "…" | null}`. Returns the class subject as in `subjects.classes[].subjects[]`.

## 2. Admissions: `/people/admissions` (permission `manage_students`)

### `POST /people/admissions`
Creates the student, the guardian (or links an existing one) and the enrollment together, or
nothing if any part fails.

```json
{
  "student": {"first_name": "Esi", "last_name": "Dahn", "gender": "female", "date_of_birth": "2018-03-02",
              "email": null, "username": null, "admission_number": null, "admission_date": null, "address": null},
  "guardian": {"existing_id": null,
               "first_name": "Kofi", "last_name": "Dahn", "relationship_type": "father",
               "phone_number": "+231…", "email": null, "username": null},
  "class_id": "…"
}
```
`guardian` may be `null` (no guardian yet) or `{"existing_id": "…"}` to link an existing parent.
Empty username/admission number: generated. Response 201:

```json
{
  "student": {"id": "…", "name": "Esi Dahn", "username": "esi.dahn", "admission_number": "STU0042"},
  "guardian": {"id": "…", "name": "Kofi Dahn", "username": "kofi.dahn", "created": true},
  "enrollment": {"id": "…", "class_id": "…", "class_name": "Grade 1 - A", "academic_year_id": "…"},
  "credentials": [{"who": "student", "name": "Esi Dahn", "username": "esi.dahn", "password": "…"},
                  {"who": "guardian", "name": "Kofi Dahn", "username": "kofi.dahn", "password": "…"}]
}
```
`credentials` lists only accounts created now, with their one-time passwords (shown once to the
admin, who hands them over; they must change them at first sign-in).

### `GET /people/guardians/search?q=` (permission `view_students`)
Up to 20 guardians of this school whose name, username, email or phone matches:
`[{"id": "…", "name": "Kofi Dahn", "username": "kofi.dahn", "email": null, "phone_number": "+231…", "children": ["Esi Dahn"]}]`.

### `POST /people/admissions/import`
Body `{"dry_run": true, "rows": [AdmissionRow, …]}` (at most 500 rows). An `AdmissionRow` is flat,
as read from a spreadsheet:
`first_name, last_name, gender, date_of_birth, email, username, admission_number, class_name,
guardian_first_name, guardian_last_name, guardian_relationship, guardian_phone, guardian_email`.
`class_name` is a class of the current year, e.g. "Grade 1 - A" (case-insensitive). Guardians in
the file with the same phone (or email) become one guardian for all their children.

Response: `{"valid": bool, "created": 0, "rows": [{"row": 2, "ok": true, "errors": []}, …],
"credentials": [...]}`. Row numbers count the header as row 1. With `dry_run` nothing is saved.
Without it, all rows are saved if every row is valid; otherwise nothing is saved and the row
errors are returned (`valid: false`, `created: 0`).
