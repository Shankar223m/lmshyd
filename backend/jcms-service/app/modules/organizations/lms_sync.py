"""Mirror LMS institutions into JCMS organizations for campus job assignment."""

from __future__ import annotations

import logging
import time
from urllib.parse import urlparse, urlunparse

from sqlalchemy import create_engine, select, text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.entities import Organization
from app.shared.enums import OrganizationType, VerificationStatus

logger = logging.getLogger(__name__)

_CACHE_SECONDS = 120.0
_last_sync_at: float = 0.0

# Reference campus names (shown when LMS DB is unreachable in local dev).
_DEMO_PARTNER_COLLEGES: list[tuple[str, str]] = [
    ("VNR VJIET", "vnr-vjiet"),
    ("CBIT", "cbit"),
    ("JNTU Hyderabad", "jntu-hyd"),
    ("Osmania University", "ou-hyd"),
    ("GRIET", "griet"),
    ("Malla Reddy Engineering College", "mrec"),
    ("Vasavi College of Engineering", "vasavi"),
    ("Kakatiya University", "kakatiya"),
]


def _user_management_database_url() -> str:
    explicit = (getattr(settings, "user_management_database_url", None) or "").strip()
    if explicit:
        return explicit.replace("postgresql+asyncpg://", "postgresql+psycopg://").replace(
            "postgresql://", "postgresql+psycopg://"
        )
    base = settings.database_url
    if not base:
        return "postgresql+psycopg://lms:lms@localhost:5432/lms_user_management"
    parsed = urlparse(base.replace("postgresql+asyncpg://", "postgresql://"))
    return urlunparse(parsed._replace(path="/lms_user_management")).replace(
        "postgresql://", "postgresql+psycopg://"
    )


def _upsert_institution_org(db: Session, *, public_id: int, name: str) -> Organization:
    reg = f"lms-org-{public_id}"
    org = db.scalar(select(Organization).where(Organization.registration_number == reg))
    if org is None:
        org = Organization(
            name=name,
            org_type=OrganizationType.INSTITUTION.value,
            registration_number=reg,
            verification_status=VerificationStatus.VERIFIED.value,
            verification_comment="Synced from LMS",
        )
        db.add(org)
        db.flush()
    else:
        if org.name != name:
            org.name = name
        if org.verification_status != VerificationStatus.VERIFIED.value:
            org.verification_status = VerificationStatus.VERIFIED.value
        if org.org_type != OrganizationType.INSTITUTION.value:
            org.org_type = OrganizationType.INSTITUTION.value
    return org


def _ensure_demo_fallback_orgs(db: Session) -> int:
    created = 0
    for name, slug in _DEMO_PARTNER_COLLEGES:
        reg = f"demo-campus-{slug}"
        org = db.scalar(select(Organization).where(Organization.registration_number == reg))
        if org is None:
            org = Organization(
                name=name,
                org_type=OrganizationType.INSTITUTION.value,
                registration_number=reg,
                verification_status=VerificationStatus.VERIFIED.value,
                verification_comment="Demo partner college",
            )
            db.add(org)
            created += 1
    if created:
        db.flush()
    return created


def sync_institutions_from_user_management(db: Session) -> int:
    """Pull active LMS institutions into JCMS. Returns number of rows processed."""
    url = _user_management_database_url()
    synced = 0
    try:
        engine = create_engine(url, pool_pre_ping=True)
        with engine.connect() as conn:
            rows = conn.execute(
                text(
                    """
                    SELECT public_id, name
                    FROM institutions
                    WHERE org_type = 'institution'
                      AND deleted_at IS NULL
                      AND status = 'active'
                    ORDER BY name ASC
                    """
                )
            ).fetchall()
        for row in rows:
            public_id = int(row[0])
            name = str(row[1] or "").strip() or f"Institution {public_id}"
            _upsert_institution_org(db, public_id=public_id, name=name)
            synced += 1
        db.flush()
    except Exception as exc:  # noqa: BLE001 — local dev may not have UM DB
        logger.warning("LMS institution sync failed: %s", exc)
        synced = 0
    if synced == 0:
        _ensure_demo_fallback_orgs(db)
    return synced


def ensure_campus_institution_orgs(db: Session, *, force: bool = False) -> None:
    global _last_sync_at
    now = time.monotonic()
    existing = db.scalar(
        select(Organization.id)
        .where(
            Organization.org_type == OrganizationType.INSTITUTION.value,
            Organization.verification_status == VerificationStatus.VERIFIED.value,
        )
        .limit(1)
    )
    if not force and existing and now - _last_sync_at < _CACHE_SECONDS:
        return
    sync_institutions_from_user_management(db)
    _last_sync_at = now
    db.flush()