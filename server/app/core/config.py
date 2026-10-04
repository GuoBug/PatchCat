"""
PatchCat Server Settings & Configuration Management
Using Pydantic v2 BaseSettings
"""

import json
from pathlib import Path
from typing import List, Union
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _resolve_app_version() -> str:
    try:
        # server/app/core/config.py -> parents[3] is repository root containing package.json
        pkg_file = Path(__file__).resolve().parents[3] / "package.json"
        if pkg_file.is_file():
            with open(pkg_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict) and "version" in data:
                    return str(data["version"])
    except Exception:
        pass
    return "0.4.14"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    APP_NAME: str = "PatchCat Backend"
    APP_VERSION: str = _resolve_app_version()
    APP_ENV: str = "development"
    DEBUG: bool = False
    API_V1_STR: str = "/api/v1"

    HOST: str = "127.0.0.1"
    PORT: int = 8000

    # Access control. Empty token = open API (only safe while bound to loopback).
    API_AUTH_TOKEN: str = ""
    # Explicit bypass flag if an administrator intentionally exposes non-loopback without auth
    ALLOW_INSECURE_NO_AUTH: bool = False
    # Per-IP requests per minute, in-process. 0 disables.
    RATE_LIMIT_PER_MINUTE: int = 600

    # Upstream AI & Embedding API Keys (for server-side RAG & model routing)
    EMBEDDING_API_KEY: str = ""
    OPENAI_API_KEY: str = ""

    # CORS Configuration
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    # File Upload Security Limits
    MAX_UPLOAD_SIZE: int = 50 * 1024 * 1024  # 50 MB
    ALLOWED_UPLOAD_EXTENSIONS: List[str] = ["pdf", "txt", "md"]

    # Database Configuration (Default: zero-setup local SQLite; or PostgreSQL with asyncpg)
    DATABASE_URL: str = "sqlite+aiosqlite:///./patchcat.db"

    @field_validator("CORS_ORIGINS", mode="before")
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        return v


settings = Settings()
