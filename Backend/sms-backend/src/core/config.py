from pydantic_settings import BaseSettings
from typing import Optional, List
import os
from pathlib import Path

class Settings(BaseSettings):
    """Application settings."""

    # Project settings
    PROJECT_NAME: str = "School Management System"
    PROJECT_DESCRIPTION: str = "A school management system built with FastAPI and SQLAlchemy."
    PROJECT_VERSION: str = "0.1.0"

    # API settings
    API_V1_STR: str = "/api/v1"
    
    # Security settings
    # Signs every login token. Required, no default: a guessable key lets anyone forge
    # tokens for any user. Generate with: python -c "import secrets; print(secrets.token_urlsafe(48))"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30  # 30 minutes
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30  # 30 days
    # Signs student ID-card QR codes. Separate from SECRET_KEY so either can be rotated
    # alone; changing it invalidates every printed card. Card/scan endpoints refuse to run unset.
    ATTENDANCE_QR_SECRET: str = os.getenv("ATTENDANCE_QR_SECRET", "")
    
    # Password policy settings
    PASSWORD_MIN_LENGTH: int = int(os.getenv("PASSWORD_MIN_LENGTH", "8"))
    PASSWORD_REQUIRE_UPPERCASE: bool = os.getenv("PASSWORD_REQUIRE_UPPERCASE", "true").lower() == "true"
    PASSWORD_REQUIRE_LOWERCASE: bool = os.getenv("PASSWORD_REQUIRE_LOWERCASE", "true").lower() == "true"
    PASSWORD_REQUIRE_NUMBERS: bool = os.getenv("PASSWORD_REQUIRE_NUMBERS", "true").lower() == "true"
    PASSWORD_REQUIRE_SPECIAL: bool = os.getenv("PASSWORD_REQUIRE_SPECIAL", "true").lower() == "true"
    PASSWORD_MAX_AGE_DAYS: int = int(os.getenv("PASSWORD_MAX_AGE_DAYS", "90"))
    
    # CORS settings - reads from CORS_ORIGINS env var (comma-separated)
    # Default: localhost:3000 for local dev
    BACKEND_CORS_ORIGINS: List[str] = [
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
        if origin.strip()
    ]
    
    # Public address of the web app, used for links in emails (password reset).
    # Defaults to the first CORS origin.
    FRONTEND_URL: str = (os.getenv("FRONTEND_URL") or os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")[0]).strip().rstrip("/")

    # Shared with the Next.js server (BFF). Only a request carrying X-Proxy-Secret equal to this
    # may name the browser's address in X-Client-IP (per-IP rate limits); empty = never trusted.
    PROXY_SHARED_SECRET: str = os.getenv("PROXY_SHARED_SECRET", "")

    # Debug mode: tracebacks and /docs. Off unless explicitly enabled (DEBUG=true in local .env)
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"

    # Database settings
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://localhost:5432/sms_db")
    # Owner connection for migrations. The API's DATABASE_URL uses the restricted sms_app role
    # (row level security applies to it); migrations need the owner. Empty: use DATABASE_URL.
    ALEMBIC_DATABASE_URL: str = os.getenv("ALEMBIC_DATABASE_URL", "")
    
    # Super admin settings
    FIRST_SUPERADMIN_EMAIL: Optional[str] = os.getenv("FIRST_SUPERADMIN_EMAIL")
    FIRST_SUPERADMIN_PASSWORD: Optional[str] = os.getenv("FIRST_SUPERADMIN_PASSWORD")
    
    # Redis settings for rate limiting
    REDIS_URL: Optional[str] = os.getenv("REDIS_URL")
    REDIS_HOST: str = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT: int = int(os.getenv("REDIS_PORT", "6379"))
    REDIS_DB: int = int(os.getenv("REDIS_DB", "0"))
    REDIS_PASSWORD: Optional[str] = os.getenv("REDIS_PASSWORD", None)
    
    # Email settings (plain SMTP, any provider). Email is off while SMTP_SERVER, SENDER_EMAIL or
    # SENDER_PASSWORD is empty: alert emails are logged as skipped. Port 465 uses SSL; otherwise
    # SMTP_USE_TLS upgrades the connection with STARTTLS.
    SMTP_SERVER: str = os.getenv("SMTP_SERVER", "")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SENDER_EMAIL: str = os.getenv("SENDER_EMAIL", "")
    SENDER_PASSWORD: str = os.getenv("SENDER_PASSWORD", "")
    SMTP_USE_TLS: bool = os.getenv("SMTP_USE_TLS", "true").lower() == "true"
    EMAIL_FROM_NAME: str = os.getenv("EMAIL_FROM_NAME", "")
    # Public address of the app for links in alert emails; defaults to FRONTEND_URL
    APP_BASE_URL: str = (os.getenv("APP_BASE_URL") or os.getenv("FRONTEND_URL")
                         or os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")[0]).strip().rstrip("/")

    # Uploaded files (services/files): "local" disk (development) or "s3" (any S3-compatible
    # bucket). FILE_STORAGE_DIR is the local folder (relative paths are under the backend folder).
    FILE_STORAGE: str = os.getenv("FILE_STORAGE", "local").strip().lower()
    FILE_STORAGE_DIR: str = os.getenv("FILE_STORAGE_DIR", "storage")
    S3_ENDPOINT_URL: str = os.getenv("S3_ENDPOINT_URL", "")
    S3_BUCKET: str = os.getenv("S3_BUCKET", "")
    S3_ACCESS_KEY_ID: str = os.getenv("S3_ACCESS_KEY_ID", "")
    S3_SECRET_ACCESS_KEY: str = os.getenv("S3_SECRET_ACCESS_KEY", "")
    S3_REGION: str = os.getenv("S3_REGION", "")

    # Logfire settings
    LOGFIRE_TOKEN: Optional[str] = os.getenv("LOGFIRE_TOKEN")
    LOGFIRE_PROJECT_NAME: str = os.getenv("LOGFIRE_PROJECT_NAME", "smsproject")
    
    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"

    # Idle enforcement settings
    IDLE_TIMEOUT_MINUTES: int = int(os.getenv("IDLE_TIMEOUT_MINUTES", "30"))
    IDLE_ENFORCEMENT_ENABLED: bool = os.getenv("IDLE_ENFORCEMENT_ENABLED", "true").lower() == "true"

MIN_SECRET_KEY_LENGTH = 32

# Create settings instance
settings = Settings()

if len(settings.SECRET_KEY) < MIN_SECRET_KEY_LENGTH:
    raise RuntimeError(
        f"SECRET_KEY must be set to at least {MIN_SECRET_KEY_LENGTH} characters. Generate one with: "
        'python -c "import secrets; print(secrets.token_urlsafe(48))"'
    )


# Email settings - require environment variables
SMTP_SERVER: str = os.getenv("SMTP_SERVER")
SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
SENDER_EMAIL: str = os.getenv("SENDER_EMAIL")
SENDER_PASSWORD: str = os.getenv("SENDER_PASSWORD")
SMTP_USE_TLS: bool = os.getenv("SMTP_USE_TLS", "true").lower() == "true"

# Add validation in __init__ or post_init
def validate_email_config(self):
    if not all([self.SMTP_SERVER, self.SENDER_EMAIL, self.SENDER_PASSWORD]):
        raise ValueError("Email configuration is incomplete. Please set SMTP_SERVER, SENDER_EMAIL, and SENDER_PASSWORD environment variables.")