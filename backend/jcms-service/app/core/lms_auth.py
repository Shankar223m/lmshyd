"""LMS JWT (JWKS) verification + upsert of CursorJobs User rows."""

from __future__ import annotations

import time
from typing import Any

import httpx
import jwt
from jwt.algorithms import RSAAlgorithm
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import AppError
from app.core.security import hash_password
from sqlalchemy import select

from app.models.entities import Organization, StudentProfile, User
from app.shared.enums import OrganizationType, UserRole, VerificationStatus

# LMS scoped `admin` is intentionally unmapped: careers.manage is super-admin-only,
# so scoped admins must not become JCMS PLATFORM_ADMINISTRATOR (falls through to "ADMIN").
_ROLE_MAP = {
    "student": UserRole.STUDENT.value,
    "employer_admin": UserRole.EMPLOYER.value,
    # Recruiter seats use the same JCMS hiring persona as employer admin (merged hiring role).
    "recruiter": UserRole.EMPLOYER.value,
    "institution_head": UserRole.INSTITUTION.value,
    "staff": UserRole.INSTITUTION.value,
    "super_admin": UserRole.PLATFORM_ADMINISTRATOR.value,
}

_jwks_cache: dict[str, Any] = {"fetched_at": 0.0, "keys": {}}


def _refresh_jwks() -> None:
    with httpx.Client(timeout=settings.lms_jwks_timeout_seconds) as client:
        response = client.get(settings.lms_jwks_url)
        response.raise_for_status()
        document = response.json()
    keys: dict[str, Any] = {}
    for item in document.get("keys") or []:
        kid = item.get("kid")
        if kid:
            keys[str(kid)] = RSAAlgorithm.from_jwk(item)
    _jwks_cache["keys"] = keys
    _jwks_cache["fetched_at"] = time.monotonic()


def decode_lms_access_token(token: str) -> dict[str, Any]:
    try:
        header = jwt.get_unverified_header(token)
        kid = str(header.get("kid") or "")
        now = time.monotonic()
        if kid not in _jwks_cache["keys"] or now - float(_jwks_cache["fetched_at"]) > settings.lms_jwks_cache_seconds:
            _refresh_jwks()
        key = _jwks_cache["keys"].get(kid)
        if key is None:
            _refresh_jwks()
            key = _jwks_cache["keys"].get(kid)
        if key is None:
            raise ValueError("Unknown signing key")
        return jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            audience=settings.lms_jwt_audience,
            issuer=settings.lms_jwt_issuer,
            leeway=10,
            options={"require": ["exp", "iat", "iss", "aud", "sub", "type"]},
        )
    except Exception as exc:  # noqa: BLE001 — map all token failures to 401
        raise AppError("UNAUTHENTICATED", "Invalid LMS access token", 401) from exc


def _map_role(raw: str | None, scopes: list[str] | None = None) -> str:
    if not raw:
        return UserRole.STUDENT.value
    role_key = str(raw).strip().lower()
    scopes_set = {str(s) for s in (scopes or [])}
    if role_key == "super_admin":
        return UserRole.PLATFORM_ADMINISTRATOR.value
    if role_key == "admin" and "careers.manage" in scopes_set:
        return UserRole.PLATFORM_ADMINISTRATOR.value
    return _ROLE_MAP.get(role_key, str(raw).upper())


def _dig(obj: Any, *path: str) -> Any:
    cur = obj
    for key in path:
        if not isinstance(cur, dict):
            return None
        cur = cur.get(key)
    return cur


def _fetch_lms_profile(authorization: str) -> dict[str, Any]:
    """LMS access tokens do not carry email; load identity from user-management."""
    try:
        with httpx.Client(timeout=settings.lms_jwks_timeout_seconds) as client:
            response = client.get(
                f"{settings.lms_user_management_url.rstrip('/')}/api/v1/users/me",
                headers={"Authorization": authorization},
            )
        if response.status_code >= 400:
            return {}
        body = response.json()
        user = body.get("user") or body.get("data") or body
        return user if isinstance(user, dict) else {}
    except httpx.HTTPError:
        return {}


def _profile_email(profile: dict[str, Any], user_id: str) -> str:
    email = (
        _dig(profile, "account", "email")
        or profile.get("email")
        or ""
    )
    email = str(email).strip().lower()
    return email or f"lms-{user_id}@lms.internal"


def _profile_full_name(profile: dict[str, Any], user_id: str) -> str:
    name = (
        _dig(profile, "personal_info", "full_name")
        or profile.get("full_name")
        or profile.get("name")
        or ""
    )
    name = str(name).strip()
    return name or f"LMS User {user_id}"


def upsert_user_from_lms_token(db: Session, token: str) -> User:
    claims = decode_lms_access_token(token)
    if claims.get("type") != "access":
        raise AppError("UNAUTHENTICATED", "Invalid token type", 401)

    user_id = str(claims.get("sub") or "").strip()
    if not user_id:
        raise AppError("UNAUTHENTICATED", "Missing subject", 401)

    scopes = claims.get("scopes")
    if not isinstance(scopes, list):
        scopes = []
    role = _map_role(claims.get("role"), scopes)
    org_id_claim = claims.get("org")

    profile = _fetch_lms_profile(f"Bearer {token}")
    email = _profile_email(profile, user_id)
    full_name = _profile_full_name(profile, user_id)

    institution = profile.get("institution") if isinstance(profile.get("institution"), dict) else None
    org_name = institution.get("name") if institution else None
    if institution and not org_id_claim:
        org_id_claim = institution.get("organization_id") or institution.get("id")

    org: Organization | None = None
    needs_org = org_id_claim and (
        role in {UserRole.EMPLOYER.value, UserRole.INSTITUTION.value, UserRole.STUDENT.value}
    )
    if needs_org:
        org_key = f"lms-org-{org_id_claim}"
        org = db.query(Organization).filter(Organization.registration_number == org_key).one_or_none()
        if org is None:
            org_type = OrganizationType.EMPLOYER.value
            if role in {UserRole.INSTITUTION.value, UserRole.STUDENT.value}:
                org_type = OrganizationType.INSTITUTION.value
            org = Organization(
                name=str(org_name or f"Organization {org_id_claim}"),
                org_type=org_type,
                registration_number=org_key,
                verification_status=VerificationStatus.VERIFIED.value,
            )
            db.add(org)
            db.flush()

    # Stable identity: LMS public user id is the JCMS primary key (do not substitute a different row by email).
    user = db.get(User, user_id)

    if user is None:
        user = User(
            id=user_id,
            email=email,
            password_hash=hash_password(f"lms-bridged-{user_id}"),
            full_name=full_name,
            role=role,
            is_active=True,
            organization_id=org.id if org else None,
        )
        db.add(user)
    else:
        if user.email != email:
            conflict = db.query(User).filter(User.email == email, User.id != user.id).one_or_none()
            if conflict is None:
                user.email = email
        user.full_name = full_name or user.full_name
        user.role = role
        user.is_active = True
        if org is not None:
            user.organization_id = org.id

    if role == UserRole.STUDENT.value:
        profile = db.scalar(select(StudentProfile).where(StudentProfile.user_id == user.id))
        if profile is None:
            profile = StudentProfile(user_id=user.id, skills=[])
            db.add(profile)
        profile.open_market_only = False
        if org is not None:
            profile.institution_id = org.id
        elif org_id_claim:
            org_key = f"lms-org-{org_id_claim}"
            campus_org = db.query(Organization).filter(Organization.registration_number == org_key).one_or_none()
            if campus_org is not None:
                profile.institution_id = campus_org.id

    db.commit()
    db.refresh(user)
    return user
