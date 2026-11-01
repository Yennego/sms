# Phase 6: Communication (design)

Scope from the implementation plan:
- schema plan §8: notification preferences, a delivery log, and a files table with object storage;
- in-app and email senders, with SMS as a stub;
- absence, late, results and payment alerts;
- announcements;
- an offline scan queue for gates.

## 1. Decisions

| Topic | Decision |
|---|---|
| Channels | Every alert lands in the in-app inbox. An email copy goes to users with an email address who haven't turned it off. SMS is a stub behind the school's `enable_sms_notifications` feature (on hold). |
| Email | Plain SMTP, so any provider works; Brevo's free tier (300/day) to start. Email is off while `SMTP_SERVER`/`SENDER_EMAIL`/`SENDER_PASSWORD` are unset: deliveries are logged as `skipped`, never fail a request. |
| Direction | One-way: alerts and announcements. Two-way messaging is a later phase. The old `messages`/`feedbacks`/`events` tables and endpoints are left as they are. |
| Attendance alerts | To the student's linked parents: **absent** (marked absent at the school's cut-off, or by staff) and **late** (scanned in late). One alert per student, day and kind. An excuse approved later doesn't send a correction. |
| Results alerts | When a class's period or semester results are published: to each student in the class and their parents. |
| Payment alerts | When a payment is recorded: to the student's parents ("USD 50.00 received, receipt 2026-00003"). Voids send nothing. |
| Announcements | Admin/principal (`send_announcements`): everyone, a role (parents, students, teachers, staff), a class (its students and their parents), or one family (a student and their parents). Teachers: only classes they teach or sponsor. Announcements are sent once; the author or an admin can withdraw one (it disappears from inboxes). |
| Preferences | Per user, per event, email only (in-app is always on). Events: `attendance_absent`, `attendance_late`, `results_published`, `payment_received`, `announcement`. Default: email on. |
| Timing | The exit criterion is an alert within 15 minutes of the cut-off: `close_attendance_days` runs every 10 minutes, and `send_notifications` (email worker) every 2 minutes. |
| Files | Uploaded bytes move out of Postgres into a `FileStorage`: `local` disk for development, `s3` (any S3-compatible bucket, such as a Railway bucket) in production. Excuse documents move first; their old `data` column is dropped after copying. |
| Offline gate queue | The gate scanner keeps scans in IndexedDB when offline and sends them when back online. The server accepts the time of the scan (`scanned_at`) to judge late/on time, within limits, and ignores a scan it has already seen (`client_scan_id`). |

## 2. Rules

- Creating alerts never blocks or fails the action that caused them: the notification rows are written in the same transaction (so they exist exactly when the action does), and email is sent later by the worker.
- Idempotent: `(tenant_id, user_id, event, source_key)` is unique; repeating an action (re-publishing, re-running the cut-off) doesn't duplicate alerts.
- All new tables have `tenant_id`, composite tenant keys and row level security like Phase 5.
- Recipients are resolved at send time; a parent linked later doesn't receive old alerts.
- Email bodies hold no more than the inbox text plus a link to the app; no marks, balances or other personal detail beyond the alert's one line.

## 3. Tables

- `notifications` (rebuilt): `id, tenant_id, user_id, event, title, body, link` (an app path such as `/foundation/parent/attendance?child=…`), `data JSON, source_key, created_at, read_at`. Unique `(tenant_id, user_id, event, source_key)`. Old rows (no tenant) are dropped.
- `notification_deliveries`: `id, tenant_id, notification_id, channel (email|sms), status (queued|sent|failed|skipped), attempts, last_error, provider_ref, created_at, sent_at`. The worker takes queued rows with `FOR UPDATE SKIP LOCKED`; three attempts with backoff, then `failed`.
- `notification_preferences`: `tenant_id, user_id, event, channel, enabled`, unique `(tenant_id, user_id, event, channel)`. No row means the default (on).
- `announcements` (rebuilt): `id, tenant_id, title, body, audience (all|role|class|family), audience_role, class_id, student_id, author_id, sent_at, withdrawn_at, withdrawn_by, recipient_count`. Old rows are dropped (there is no working screen for them).
- `files`: `id, tenant_id, storage_key, filename, content_type, size_bytes, sha256, uploaded_by, created_at`. `attendance_documents` gains `file_id` and loses `data`.
- `daily_attendances`/scan path: `attendance_events` gains `client_scan_id` (unique per school when set).

## 4. Permissions

| Action | Permission |
|---|---|
| Read own inbox, set own preferences | any signed-in user |
| Send announcements to anyone | `send_announcements` (new; granted to admin) |
| Send announcements to own classes | teacher of the class subject or class sponsor (no permission needed) |
| Withdraw an announcement | its author, or `send_announcements` |
| Delivery log and retry | `manage_tenant_settings` |

## 5. API (under `/api/v1/communication`)

- `GET /inbox?unread_only&page&page_size` → `{items: [{id, event, title, body, link, created_at, read_at}], total, page, page_size, pages, unread}`
- `GET /inbox/unread-count` → `{unread}` (the bell polls this every 60 s)
- `POST /inbox/{id}/read`, `POST /inbox/read-all` → `{unread}`
- `GET /preferences` → `{email: string|null, email_configured: bool, items: [{event, label, email: bool}]}`; `PUT /preferences` with `[{event, email}]` → same.
- `GET /announcements?page` → announcements visible to the caller (sent to them, or written by them, or all for `send_announcements`), newest first: `{items: [{id, title, body, audience, audience_label, author_name, sent_at, withdrawn_at, recipient_count, can_withdraw}], total, page, page_size, pages}`
- `GET /announcements/audiences` → what the caller may target: `{roles: [...], classes: [{id, name}], family: bool}`
- `POST /announcements {title, body, audience, audience_role?, class_id?, student_id?}` → the announcement (with `recipient_count`)
- `POST /announcements/{id}/withdraw` → the announcement
- `GET /deliveries?status&channel&from&to&page` → `{items: [{id, channel, status, attempts, last_error, created_at, sent_at, recipient_name, recipient_email, event, title}], total, ..., counts: {queued, sent, failed, skipped}}`; `POST /deliveries/{id}/retry`.
- Attendance scan (existing endpoint) accepts optional `scanned_at` and `client_scan_id`. `scanned_at` counts only when it falls today (school time), and is at most 12 hours old. A time in the future (a wrong device clock) is replaced by the server's time; a read from an earlier day or over 12 hours old is rejected with `scan_expired`, so a scan saved yesterday never counts for today.

The old `/communication/notifications*` and `/communication/announcements*` endpoints are replaced.

## 6. Screens

- **Bell and inbox** (every role): a bell with the unread count in the app shell; `/{school}/inbox` lists alerts and announcements, newest first, with "Mark all as read"; tapping one opens its link.
- **Announcements** (staff with access): list of sent announcements and a "New announcement" sheet (audience picker limited by `/announcements/audiences`, then title and message, then a confirm showing who will receive it).
- **Notification settings** (user menu, every role): one email switch per event; explains when email is off for the school or the user has no email address.
- **Delivery log** (Settings, admin): filters by status and channel, retry for failed.
- **Gate scanner**: works offline; a banner shows "3 scans waiting to send" and sends them when back online.

## 7. Configuration

- `SMTP_SERVER`, `SMTP_PORT`, `SENDER_EMAIL`, `SENDER_PASSWORD`, `SMTP_USE_TLS`, `EMAIL_FROM_NAME`.
- `APP_BASE_URL` (links in emails).
- `FILE_STORAGE` (`local` | `s3`), `FILE_STORAGE_DIR` (local), `S3_ENDPOINT_URL`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION`.
- Cron: `python -m scripts.close_attendance_days` every 10 minutes; `python -m scripts.send_notifications` every 2 minutes.

## 8. As built

Backend: migration `b6f2d9a4e8c1_phase6_communication`; routes in `src/api/v1/endpoints/communication/inbox.py`; service `src/services/communication/communication_service.py`; alerts in `src/services/notification/` (`notify.py`, `alerts.py`, `senders.py`, `dispatch.py`); files in `src/services/files/`; worker `scripts/send_notifications.py`.

### Response fields (all under `/api/v1/communication`)

Times are ISO 8601 with offset; ids are UUID strings. Lists are paged: `page` (from 1), `page_size` (default 20, deliveries 25; at most 100), `pages` (at least 1).

- `GET /inbox?unread_only=false&page=1&page_size=20` → `{items: [{id, event, title, body, link, created_at, read_at}], total, page, page_size, pages, unread}`. Newest first. `link` is an app path including the school (`/{school}/...`) or `null` (announcements have none: show the body).
- `GET /inbox/unread-count` → `{unread}`.
- `POST /inbox/{id}/read` → `{unread}` (404 for another user's notification; reading twice is fine). `POST /inbox/read-all` → `{unread: 0}`.
- `GET /preferences` → `{email: string|null, email_configured: bool, items: [{event, label, email}]}`, events always in this order: `attendance_absent` ("Absence alerts"), `attendance_late` ("Late arrival alerts"), `results_published` ("Results published"), `payment_received` ("Payments received"), `announcement` ("Announcements"). `email_configured` is false while the server has no SMTP settings.
- `PUT /preferences` with `[{event, email}]` (only the events sent change) → same as GET. Unknown event: 422.
- `GET /announcements?page&page_size` → `{items: [Announcement], total, page, page_size, pages}`, newest first, where Announcement is `{id, title, body, audience, audience_role, class_id, student_id, audience_label, author_id, author_name, sent_at, withdrawn_at, recipient_count, can_withdraw}`. `audience_label`: "Everyone", "Parents", "Students", "Teachers", "Staff", "Class {class name}" or "Family of {student name}".
- `GET /announcements/audiences` → `{roles: string[], classes: [{id, name}], family: bool}`. With `send_announcements`: all four roles, every class of the current school year, `family: true`. Otherwise: `roles: []`, the current-year classes the caller teaches a subject in (class subject teacher) or sponsors, `family: false` (empty lists for everyone else).
- `POST /announcements` with `{title (1-200), body (1-5000), audience: all|role|class|family, audience_role?: parents|students|teachers|staff, class_id?, student_id?}` → Announcement (status 200). 403 when the caller may not target that audience; 404 for a class or student not in the school; 422 for a missing field.
- `POST /announcements/{id}/withdraw` → Announcement. 403 unless the author or `send_announcements`; 409 if already withdrawn.
- `GET /deliveries?status&channel&from&to&page&page_size` (`from`/`to` are dates, school time, on `created_at`) → `{items: [{id, channel, status, attempts, last_error, created_at, sent_at, recipient_name, recipient_email, event, title}], total, page, page_size, pages, counts: {queued, sent, failed, skipped}}`. `counts` follow the channel and date filters but not the status filter. Needs `manage_tenant_settings`.
- `POST /deliveries/{id}/retry` → the delivery row as above, back to `queued` with `attempts: 0`. Only `failed` or `skipped` rows (409 otherwise).

Gate scanner: `POST /api/v1/academics/attendance/scan` (`{token, mode, device_label?, scanned_at?, client_scan_id?}`) and the manual fallback `POST /api/v1/academics/attendance/scan/manual` (`{admission_number, device_label?, scanned_at?, client_scan_id?}`) both take the queue fields. `client_scan_id` is 1-64 characters (a UUID is fine). Sending a `client_scan_id` again returns the first outcome without logging anything: `result: "duplicate"` (with the student, status and check-in time) if the first was accepted or a duplicate, or the same `result: "rejected"` and `reason` if it was rejected. The response shape is unchanged (`ScanResult`).

### Alert texts and links

| Event | Recipients | Title / body | Link |
|---|---|---|---|
| `attendance_absent` | parents | "{First} was absent" / "{Full name} was marked absent on Tue 20 Oct 2026." | `/{school}/parent/attendance?child={student_id}` |
| `attendance_late` | parents | "{First} arrived late" / "{Full name} arrived late at 08:42 on Tue 20 Oct 2026." | same |
| `results_published` | the student | "Results published" / "Your Period 1 results (Grade 5 - A) are published." | `/{school}/student/grades` |
| `results_published` | parents | "{First}'s results are published" / "{Full name}'s Period 1 results (Grade 5 - A) are published." | `/{school}/parent/results?child={student_id}` |
| `payment_received` | parents | "Payment received" / "USD 50.00 received for {Full name}, receipt 2026-00003." | `/{school}/parent/fees?child={student_id}` |
| `announcement` | the audience | the announcement's title / body | none |

The parent results and fees pages don't read `?child=` yet; the attendance page does.

### Deviations from §1-§5

- Every new table also has `updated_at` (as all school tables do).
- `notification_deliveries` has `next_attempt_at` for the retry backoff (2 minutes, then 10; the third failure is `failed`). Skipped rows are never retried by the worker; an admin can retry them.
- Withdrawing an announcement deletes its inbox notifications and their delivery rows (sent emails can't be recalled; their log rows go too). The announcement keeps `recipient_count`, `withdrawn_at` and `withdrawn_by`.
- Audience rules: "staff" is every user who isn't a student or a parent (teachers included). Recipients are active users only; platform super-admins and the author are never recipients. A class audience is the class's actively enrolled students and their linked parents; a family is the student and their linked parents. `recipient_count` is the number of inbox notifications written.
- Email copies are queued only for users with an email address who haven't turned the event off; users without an address get no delivery row (not a `skipped` one). SMS rows are created only when the school's `enable_sms_notifications` switch is on and the user has a phone number; the SMS stub marks them `skipped`.
- Results alerts go to the class's actively enrolled students and their parents, once per student and period/semester (unpublishing and publishing again sends nothing new).
- Absence alerts are sent for daily attendance (cut-off, roster auto-fill, staff marks, including the bulk roster). Period/subject attendance (the older `attendances` table) sends none. A parent-reported absence sends none.
- The manual check-in endpoint also takes `scanned_at` / `client_scan_id`.
- Excuse documents: uploading a replacement points the document at a new file; the old stored object is kept, unreferenced.
