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
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-for-development")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8  # 8 days
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30  # 30 days
    
    # Password policy settings
    PASSWORD_MIN_LENGTH: int = int(os.getenv("PASSWORD_MIN_LENGTH", "8"))
    PASSWORD_REQUIRE_UPPERCASE: bool = os.getenv("PASSWORD_REQUIRE_UPPERCASE", "true").lower() == "true"
    PASSWORD_REQUIRE_LOWERCASE: bool = os.getenv("PASSWORD_REQUIRE_LOWERCASE", "true").lower() == "true"
    PASSWORD_REQUIRE_NUMBERS: bool = os.getenv("PASSWORD_REQUIRE_NUMBERS", "true").lower() == "true"
    PASSWORD_REQUIRE_SPECIAL: bool = os.getenv("PASSWORD_REQUIRE_SPECIAL", "true").lower() == "true"
    PASSWORD_MAX_AGE_DAYS: int = int(os.getenv("PASSWORD_MAX_AGE_DAYS", "90"))
    
    # CORS settings
    # BACKEND_CORS_ORIGINS: List[str] = ["*"]
    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:3000", "https://yourdomain.com"]
    
    # Database settings
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://postgres:199922@localhost:5432/sms_db")
    
    # Super admin settings
    FIRST_SUPERADMIN_EMAIL: Optional[str] = os.getenv("FIRST_SUPERADMIN_EMAIL")
    FIRST_SUPERADMIN_PASSWORD: Optional[str] = os.getenv("FIRST_SUPERADMIN_PASSWORD")
    
    # Redis settings for rate limiting
    REDIS_HOST: str = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT: int = int(os.getenv("REDIS_PORT", "6379"))
    REDIS_DB: int = int(os.getenv("REDIS_DB", "0"))
    REDIS_PASSWORD: Optional[str] = os.getenv("REDIS_PASSWORD", None)
    
    # Email settings
    SMTP_SERVER: str = os.getenv("SMTP_SERVER", "smtp-mail.outlook.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SENDER_EMAIL: str = os.getenv("SENDER_EMAIL", "topfoundation@outlook.com")
    SENDER_PASSWORD: str = os.getenv("SENDER_PASSWORD", "your-outlook-password")
    SMTP_USE_TLS: bool = os.getenv("SMTP_USE_TLS", "true").lower() == "true"
    
    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"

# Create settings instance
settings = Settings()


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