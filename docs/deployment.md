# Deployment

How the app runs in production, and how to set it up the first time. Replace `example.org` with the
school platform's domain throughout (the app lives at `app.example.org`, the API at `api.example.org`).

| Piece | Service | What it holds |
|---|---|---|
| Web app (Next.js) | Vercel | `Frontend/sms-client`, `app.example.org` |
| API (FastAPI) | FastAPI Cloud | `Backend/sms-backend`, `api.example.org` |
| Database | Neon (PostgreSQL 17) | everything |
| Cache, sign-in limits | Upstash Redis | short-lived data only (the app works without it) |
| Uploaded files | Cloudflare R2 | excuse documents (logos and photos go to Vercel Blob) |
| Email | Brevo (SMTP) | alert copies, password resets, billing reminders |
| Domain, DNS | Cloudflare | all DNS records |
| Scheduled jobs | GitHub Actions | `.github/workflows/scheduled-jobs.yml` |

FastAPI Cloud has no scheduler and scales the API to zero when nobody uses it, so four jobs run from
GitHub Actions against the database: closing attendance days and sending queued emails every 5
minutes, platform billing and file clean-up daily. The first request after a quiet period takes a few
seconds longer while the API starts.

## 0. Secrets to generate first

Generate each once (`python -c "import secrets; print(secrets.token_urlsafe(48))"`) and keep them in
a password manager:

| Name | Used by | Notes |
|---|---|---|
| `SECRET_KEY` | API, jobs | signs sign-in tokens; changing it signs everyone out |
| `ATTENDANCE_QR_SECRET` | API, jobs | signs the QR codes on ID cards. **If cards were already printed from another setup, reuse that value**, or those cards stop scanning |
| `PROXY_SHARED_SECRET` | API and Vercel (same value) | lets the API see each visitor's address for sign-in limits |
| `sms_app` password | Neon | the API's database role |

## 1. Neon (database)

1. Create a project, PostgreSQL 17. Pick the region closest to the API (FastAPI Cloud shows its region
   in the app's dashboard; until you know it, AWS US East is the usual default).
2. From **Connect**, copy two connection strings for the owner role (e.g. `neondb_owner`):
   - the **direct** one (host without `-pooler`): this is `ALEMBIC_DATABASE_URL`, used for migrations;
   - keep it at hand for the restore below.
3. Load the data (one of):
   - **Move the local database** (keeps the schools, students and sign-ins already handed out). On the
     machine with the local database:
     ```powershell
     pg_dump --format=custom --no-owner --no-privileges --dbname "postgresql://postgres:<local password>@localhost:5432/sms_db" --file sms_db.dump
     pg_restore --no-owner --no-privileges --dbname "<ALEMBIC_DATABASE_URL>" sms_db.dump
     ```
     Then delete `sms_db.dump`: it contains everyone's data.
   - **Start empty**: run the migrations (step 8 or `alembic upgrade head` with `ALEMBIC_DATABASE_URL`
     set), then create the first platform operator with `scripts/reset_super_admin_password.py`.
4. Create the API's restricted role (row level security only works for it), as the owner:
   ```powershell
   psql "<ALEMBIC_DATABASE_URL>" -v app_password="'<sms_app password>'" -f Backend/sms-backend/scripts/create_app_db_role.sql
   ```
5. The API's `DATABASE_URL` is the **pooled** string (host with `-pooler`) with the user and password
   replaced by `sms_app` and its password, and `?sslmode=require`.

Do not use FastAPI Cloud's Neon integration for `DATABASE_URL`: it connects as the owner, which skips
the per-school data walls.

## 2. Upstash (Redis)

Create a Redis database (same region as the API). Copy the `rediss://…` URL: this is `REDIS_URL`.

## 3. Cloudflare R2 (files)

1. Create a bucket, e.g. `sms-files` (private).
2. **R2 → Manage API tokens → Create**: Object Read & Write, this bucket only. Note the access key ID,
   the secret, and the S3 endpoint `https://<account id>.r2.cloudflarestorage.com`.
3. If you moved the local database and it has excuse documents, copy the local `storage/` folder into
   the bucket with the same paths (e.g. `rclone copy Backend/sms-backend/storage r2:sms-files`).

## 4. Brevo (email)

1. **Senders & domains → Domains → Add a domain**: `example.org`. Add the records Brevo shows (Brevo
   code TXT, DKIM, DMARC) in Cloudflare DNS (step 7), then verify.
2. **SMTP & API → SMTP**: note the server (`smtp-relay.brevo.com`), port `587`, the login, and create
   an SMTP key (the password).
3. Choose the sender address, e.g. `no-reply@example.org` (add it under **Senders**).

## 5. FastAPI Cloud (API)

1. On your computer, in `Backend/sms-backend`: `uv sync`, then `uv run fastapi login`.
2. `uv run fastapi deploy` from `Backend/sms-backend` (first time: create the app, e.g. `sms-api`). The
   app is found from `pyproject.toml` (`[tool.fastapi] entrypoint = "main:app"`); dependencies come
   from `uv.lock`; files listed in `.fastapicloudignore` (tests, `.env`, logs, local data) are not
   uploaded. To deploy from GitHub instead, link the repo and set **Settings → Application Directory**
   to `Backend/sms-backend`.
3. **Environment Variables** (mark the secret ones as Secret), then redeploy:

| Variable | Value |
|---|---|
| `DATABASE_URL` | the `sms_app` pooled string (step 1.5) — secret |
| `ALEMBIC_DATABASE_URL` | the owner direct string — secret |
| `SECRET_KEY` | step 0 — secret |
| `ATTENDANCE_QR_SECRET` | step 0 — secret |
| `PROXY_SHARED_SECRET` | step 0 — secret |
| `REDIS_URL` | step 2 — secret |
| `CORS_ORIGINS` | `https://app.example.org` |
| `FRONTEND_URL` | `https://app.example.org` |
| `APP_BASE_URL` | `https://app.example.org` (links in emails) |
| `SMTP_SERVER` / `SMTP_PORT` / `SMTP_USE_TLS` | `smtp-relay.brevo.com` / `587` / `true` |
| `SENDER_EMAIL` | the Brevo SMTP login |
| `SENDER_PASSWORD` | the Brevo SMTP key — secret |
| `EMAIL_FROM_NAME` | e.g. `School platform` (shown as the sender) |
| `FILE_STORAGE` | `s3` |
| `S3_ENDPOINT_URL` / `S3_BUCKET` / `S3_REGION` | step 3 / `sms-files` / `auto` |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | step 3 — secret |
| `DEBUG` | `false` |
| `LOGFIRE_TOKEN` | optional (error tracing) — secret |

4. **Domains → Add Custom Domain** `api.example.org`; add the CNAME it shows in Cloudflare (step 7).
5. Check: `https://api.example.org/api/v1/health` (or any public route) answers.

## 6. Vercel (web app)

1. Import the GitHub repo; **Root Directory** `Frontend/sms-client`; production branch `main`.
2. **Storage → Blob → Create** and connect it to the project (adds `BLOB_READ_WRITE_TOKEN`).
3. **Settings → Environment Variables** (Production):

| Variable | Value |
|---|---|
| `BACKEND_API_URL` | `https://api.example.org/api/v1` |
| `NEXT_PUBLIC_API_URL` | `https://api.example.org/api/v1` |
| `PROXY_SHARED_SECRET` | the same value as the API's |
| `NEXT_PUBLIC_PLATFORM_NAME` | optional, the platform's name |

4. **Settings → Domains**: add `app.example.org` (and `example.org` if the root should show the
   "Find your school" page); add the records Vercel shows in Cloudflare.

## 7. Cloudflare DNS

| Name | Type | Target | Proxy |
|---|---|---|---|
| `app` | CNAME | as shown by Vercel (e.g. `cname.vercel-dns.com`) | DNS only |
| `api` | CNAME | `<id>.endpoints.fastapicloud.dev` (from FastAPI Cloud) | **DNS only** (required) |
| Brevo records | TXT / CNAME | as shown by Brevo | DNS only |

If the zone has a CAA record, allow `pki.goog` (FastAPI Cloud's certificates) and `letsencrypt.org`
(Vercel).

## 8. GitHub (scheduled jobs and migrations)

**Settings → Secrets and variables → Actions → New repository secret**, with the same values as the
API:

`PROD_DATABASE_URL` (sms_app), `PROD_ALEMBIC_DATABASE_URL` (owner), `PROD_SECRET_KEY`,
`PROD_ATTENDANCE_QR_SECRET`, `PROD_APP_BASE_URL`, `PROD_SMTP_SERVER`, `PROD_SMTP_PORT`,
`PROD_SENDER_EMAIL`, `PROD_SENDER_PASSWORD`, `PROD_EMAIL_FROM_NAME`, `PROD_S3_ENDPOINT_URL`,
`PROD_S3_BUCKET`, `PROD_S3_ACCESS_KEY_ID`, `PROD_S3_SECRET_ACCESS_KEY`.

Create an environment named `production` (**Settings → Environments**) and, if you like, require
your approval for it: the migration workflow waits for it.

Then **Actions → Scheduled jobs → Run workflow → all** once, and check it finishes green. From then on
it runs by itself.

## 9. First checks

1. Sign in as the platform operator at `https://app.example.org/platform/login`.
2. Open a school, sign in as its admin, and check Home, Students, Attendance → Today.
3. Request a password reset for an account with an email: the email arrives (and **Settings →
   Delivery log** shows it sent).
4. Mark a test attendance and upload an excuse document; open the document again.
5. After the attendance cut-off, check the unmarked students were recorded absent (Scheduled jobs ran).

## Every release

1. If the release adds a migration (`Backend/sms-backend/alembic/versions`), first run **Actions →
   Migrate production → Run workflow** (type `migrate`). The API runs old and new versions side by
   side during a deploy, so migrations must work with the code already running (add before you use;
   remove only after nothing uses it).
2. Deploy the API: `uv run fastapi deploy` from `Backend/sms-backend` (or the GitHub integration).
3. Vercel deploys the web app by itself when `main` changes.
