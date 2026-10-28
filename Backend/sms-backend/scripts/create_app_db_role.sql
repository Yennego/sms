-- Application database role for row level security (docs/remodel/02-technical-requirements.md §3).
--
-- Superusers and roles with BYPASSRLS ignore the tenant policies, so the API must connect as an
-- ordinary role. Migrations keep using the owner/admin connection.
--
-- Run once per database as the owner, after `alembic upgrade head`, replacing the password:
--   psql "$ADMIN_DATABASE_URL" -v app_password="'<strong password>'" -f scripts/create_app_db_role.sql
-- Then set the API's DATABASE_URL to use sms_app, and ALEMBIC_DATABASE_URL to the owner URL.

CREATE ROLE sms_app LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD :app_password;

SELECT format('GRANT CONNECT ON DATABASE %I TO sms_app', current_database()) \gexec
GRANT USAGE ON SCHEMA public TO sms_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO sms_app;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO sms_app;

-- Tables and sequences created by later migrations (run by the owner) are granted automatically
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sms_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO sms_app;
