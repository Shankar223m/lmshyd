import uuid
from typing import Annotated

from fastapi import Depends, Header, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.exceptions import AppError
from app.core.security import decode_token
from app.models.entities import User
from app.shared.enums import UserRole

security = HTTPBearer(auto_error=False)
DbSession = Annotated[Session, Depends(get_db)]


def get_request_id(x_request_id: str | None = Header(default=None)) -> str:
    return x_request_id or str(uuid.uuid4())


def attach_request_id(request: Request, request_id: str = Depends(get_request_id)) -> str:
    request.state.request_id = request_id
    return request_id


def get_current_user(
    db: DbSession,
    creds: HTTPAuthorizationCredentials | None = Depends(security),
) -> User:
    if not creds:
        raise AppError("UNAUTHENTICATED", "Authentication required", 401)

    # LMS mode: verify user-management JWT and upsert a local JCMS user for workflows.
    from app.core.config import settings as _settings

    if _settings.lms_auth_enabled:
        from app.core.lms_auth import upsert_user_from_lms_token

        return upsert_user_from_lms_token(db, creds.credentials)

    try:
        payload = decode_token(creds.credentials)
    except ValueError as exc:
        raise AppError("UNAUTHENTICATED", "Invalid token", 401) from exc
    if payload.get("type") != "access":
        raise AppError("UNAUTHENTICATED", "Invalid token type", 401)
    user = db.get(User, payload["sub"])
    if not user or not user.is_active:
        raise AppError("UNAUTHENTICATED", "User not found or inactive", 401)
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_roles(*roles: UserRole):
    allowed = {(r.value or "").upper() for r in roles}

    def checker(user: CurrentUser) -> User:
        if (user.role or "").strip().upper() not in allowed:
            raise AppError("FORBIDDEN", "Insufficient permissions", 403)
        return user

    return checker
