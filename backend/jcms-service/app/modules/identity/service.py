from datetime import UTC, datetime, timedelta

from jose import jwt
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.entities import Organization, RefreshToken, StudentProfile, User
from app.modules.audit.service import record_audit
from app.shared.enums import OrganizationType, UserRole, VerificationStatus


def register_user(
    db: Session,
    *,
    email: str,
    password: str,
    full_name: str,
    role: UserRole,
    organization_name: str | None = None,
) -> User:
    clean_email = email.strip().lower()
    if db.scalar(select(User).where(func.lower(User.email) == clean_email)):
        raise ValueError("EMAIL_EXISTS")

    org_id = None
    if role in (UserRole.EMPLOYER, UserRole.INSTITUTION):
        if not organization_name:
            raise ValueError("ORG_NAME_REQUIRED")
        org_type = (
            OrganizationType.EMPLOYER
            if role == UserRole.EMPLOYER
            else OrganizationType.INSTITUTION
        )
        org = Organization(
            name=organization_name,
            org_type=org_type.value,
            verification_status=VerificationStatus.PENDING.value,
        )
        db.add(org)
        db.flush()
        org_id = org.id

    user = User(
        email=clean_email,
        password_hash=hash_password(password),
        full_name=full_name,
        role=role.value,
        organization_id=org_id,
    )
    db.add(user)
    db.flush()

    if role == UserRole.STUDENT:
        db.add(StudentProfile(user_id=user.id, skills=[]))

    record_audit(
        db,
        actor_id=user.id,
        action="user.register",
        resource_type="user",
        resource_id=user.id,
        metadata={"role": role.value},
    )
    return user


def authenticate(db: Session, email: str, password: str, *, client_ip: str | None = None) -> tuple[User, str, str]:
    user = db.scalar(select(User).where(User.email == email.lower()))
    if not user or not verify_password(password, user.password_hash):
        raise ValueError("INVALID_CREDENTIALS")
    access = create_access_token(user.id, {"role": user.role})
    refresh = create_refresh_token(user.id)
    payload = decode_token(refresh)
    db.add(
        RefreshToken(
            user_id=user.id,
            token_jti=payload["jti"],
            expires_at=datetime.fromtimestamp(payload["exp"], tz=UTC),
        )
    )
    record_audit(
        db,
        actor_id=user.id,
        action="auth.login.success",
        resource_type="user",
        resource_id=user.id,
        metadata={"role": user.role, "ip": client_ip},
    )
    return user, access, refresh


def refresh_access_token(db: Session, refresh_token: str) -> tuple[str, str]:
    payload = decode_token(refresh_token)
    if payload.get("type") != "refresh":
        raise ValueError("INVALID_TOKEN")
    rt = db.scalar(select(RefreshToken).where(RefreshToken.token_jti == payload["jti"]))
    if not rt or rt.revoked:
        raise ValueError("INVALID_TOKEN")
    user = db.get(User, payload["sub"])
    if not user or not user.is_active:
        raise ValueError("INVALID_TOKEN")
    access = create_access_token(user.id, {"role": user.role})
    new_refresh = create_refresh_token(user.id)
    rt.revoked = True
    new_payload = decode_token(new_refresh)
    db.add(
        RefreshToken(
            user_id=user.id,
            token_jti=new_payload["jti"],
            expires_at=datetime.fromtimestamp(new_payload["exp"], tz=UTC),
        )
    )
    return access, new_refresh
