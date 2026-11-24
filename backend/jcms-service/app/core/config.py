from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Locate root directory (containing .env)
ROOT_DIR = Path(__file__).resolve().parents[2]
ROOT_ENV = ROOT_DIR / ".env"

_DEV_SECRET_DEFAULT = "dev-secret-change-me"


class Settings(BaseSettings):
    # Automatically check root .env first, then current working directory .env
    model_config = SettingsConfigDict(
        env_file=(str(ROOT_ENV), ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "JCMS"
    app_env: str = "development"
    debug: bool = True
    secret_key: str = _DEV_SECRET_DEFAULT
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    # Consistent default database credentials matching docker-compose.yml host port
    postgres_user: str = "jcms"
    postgres_password: str = "jcms"
    postgres_host: str = "localhost"
    postgres_port: int = 5433
    postgres_db: str = "jcms"

    database_url: str = "postgresql+psycopg://jcms:jcms@localhost:5433/jcms"
    redis_url: str = "redis://localhost:6379/0"

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    storage_backend: str = "local"
    storage_local_path: str = "./storage"

    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"

    frontend_url: str = "http://localhost:5173"

    # LMS authentication (JWKS from user-management). JCMS login is disabled in LMS mode.
    lms_auth_enabled: bool = True
    lms_jwks_url: str = "http://localhost:8001/.well-known/jwks.json"
    lms_user_management_url: str = "http://localhost:8001"
    lms_jwt_issuer: str = "lms-user-management"
    lms_jwt_audience: str = "lms"
    lms_jwks_cache_seconds: int = 300
    lms_jwks_timeout_seconds: float = 5.0
    user_management_database_url: str | None = None

    smtp_enabled: bool = False
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from_email: str = "noreply@jcms.local"
    smtp_use_tls: bool = True

    @property
    def is_production_like(self) -> bool:
        return self.app_env.lower() in {"staging", "production"}

    def validate_security(self) -> None:
        """Staging and production refuse to start with development values."""
        if not self.is_production_like:
            return
        problems = []
        if self.debug:
            problems.append("DEBUG must be false")
        if self.secret_key in {"dev-secret-change-me", "change-me"} or len(self.secret_key) < 32:
            problems.append("SECRET_KEY must be a long random value, not the development default")
        if not self.lms_auth_enabled:
            problems.append("LMS_AUTH_ENABLED must stay true: sign-in is through the LMS")
        if problems:
            raise ValueError("; ".join(problems))

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production_like(self) -> bool:
        return self.app_env.strip().lower() in {"staging", "production"}

    @model_validator(mode="after")
    def validate_security(self) -> "Settings":
        if not self.is_production_like:
            return self
        errors: list[str] = []
        if self.debug:
            errors.append("debug must be false when app_env is staging/production")
        if self.secret_key == _DEV_SECRET_DEFAULT or len(self.secret_key) < 32:
            errors.append("secret_key must be a strong non-default value (32+ chars) outside local/dev")
        if errors:
            raise ValueError("JCMS production settings invalid: " + "; ".join(errors))
        return self


settings = Settings()
