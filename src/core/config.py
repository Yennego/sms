# src/core/config.py

import os
import codecs

# —————————————————————————————————————————————
# BOILERPLATE: Strip BOM from `.env` if present
# —————————————————————————————————————————————
env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir, ".env"))
if os.path.exists(env_path):
    # Read raw bytes
    raw = open(env_path, "rb").read()
    # Decode with utf-8-sig to strip BOM; fallback to latin-1 if needed
    text = None
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("latin-1")
    # Write back as clean UTF-8 (no BOM)
    with open(env_path, "w", encoding="utf-8") as f:
        f.write(text)



import secrets
from typing import List, Optional, Union
from functools import lru_cache

from pydantic import AnyHttpUrl, PostgresDsn, Field, validator, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "School Management System"
    API_V1_STR: str = "/api/v1"
    DEBUG: bool = True

    # SECURITY
    SECRET_KEY: str = "your-secret-key-here"  # Change this in production
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    ALGORITHM: str = "HS256"

    # CORS
    BACKEND_CORS_ORIGINS: List[AnyHttpUrl] = []

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> Union[List[str], str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)

    # DATABASE
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "199922"  # Your PostgreSQL password
    POSTGRES_DB: str = "sms_db"
    DATABASE_URL: Optional[str] = None

    @field_validator("DATABASE_URL", mode="before")
    def assemble_db_connection(cls, v: Optional[str], info) -> str:
        if isinstance(v, str):
            return v
        
        return f"postgresql://{info.data.get('POSTGRES_USER')}:{info.data.get('POSTGRES_PASSWORD')}@{info.data.get('POSTGRES_SERVER')}:5432/{info.data.get('POSTGRES_DB')}"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )


@lru_cache()
def get_settings() -> Settings:
    return Settings()

settings = get_settings()