#!/usr/bin/env python3
"""Remove junk/test job postings and seed realistic campus demo jobs (publish-ready).

Usage:
  cd backend/jcms-service
  PYTHONPATH=. python scripts/reseed_realistic_campus_jobs.py

Requires DATABASE_URL (local Docker stack or .env).
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR.parent))
sys.path.insert(0, str(SCRIPT_DIR))

from sqlalchemy import select

from campus_demo_jobs_catalog import CAMPUS_DEMO_JOBS, CAMPUS_DEMO_ORGS, CLOSES
from app.core.database import SessionLocal
from app.models.entities import Job, Organization, User
from app.modules.eligibility.service import seed_eligibility_from_payload
from app.modules.jobs import service as job_service
from app.shared.enums import JobStatus, OrganizationType, UserRole, VerificationStatus

JUNK_TITLE = re.compile(
    r"(?i)^(E2E|QA |Test |x$|Untitled draft)|"
    r"Demo Pending|Automated hire|hire-chain|GenZ Test|Moderation Role",
)


def is_junk_job(job: Job) -> bool:
    title = (job.title or "").strip()
    desc = (job.description or "").strip()
    if JUNK_TITLE.search(title):
        return True
    if len(desc) < 80 and title.lower() not in {j["title"].lower() for j in CAMPUS_DEMO_JOBS}:
        return True
    if desc.lower() in {"y", "x", "test", "build lms hiring flows with python and react."}:
        return True
    if "e2e" in title.lower() or "e2e" in desc.lower():
        return True
    return False


def keep_catalog_titles() -> set[str]:
    return {j["title"].strip().lower() for j in CAMPUS_DEMO_JOBS}


def get_platform_admin(db) -> User | None:
    return db.scalar(select(User).where(User.role == UserRole.PLATFORM_ADMINISTRATOR.value).limit(1))


def ensure_org(db, spec: dict[str, str]) -> Organization:
    org = db.scalar(select(Organization).where(Organization.name == spec["name"]))
    if not org:
        org = Organization(
            name=spec["name"],
            org_type=OrganizationType.EMPLOYER.value,
            website=spec.get("website"),
            industry=spec.get("industry"),
            verification_status=VerificationStatus.VERIFIED.value,
            verification_comment="Campus demo employer",
        )
        db.add(org)
        db.flush()
    else:
        if org.org_type != OrganizationType.EMPLOYER.value:
            org.org_type = OrganizationType.EMPLOYER.value
        org.verification_status = VerificationStatus.VERIFIED.value
    return org


def main() -> int:
    catalog_titles = keep_catalog_titles()
    stats = {"closed": 0, "created": 0, "skipped": 0, "kept_published": 0}

    db = SessionLocal()
    try:
        admin = get_platform_admin(db)
        if not admin:
            print("ERROR: no PLATFORM_ADMINISTRATOR user in JCMS. Log in as super admin once via LMS.", file=sys.stderr)
            return 1

        for spec in CAMPUS_DEMO_ORGS:
            ensure_org(db, spec)

        jobs = db.scalars(select(Job)).all()
        for job in jobs:
            title_key = (job.title or "").strip().lower()
            if title_key in catalog_titles and job.status == JobStatus.PUBLISHED.value:
                stats["kept_published"] += 1
                continue
            if is_junk_job(job) or (
                job.status in (JobStatus.PUBLISHED.value, JobStatus.UNDER_REVIEW.value, JobStatus.DRAFT.value)
                and title_key not in catalog_titles
            ):
                job.status = JobStatus.CLOSED.value
                stats["closed"] += 1

        db.commit()

        org_by_name = {
            o.name: o
            for o in db.scalars(select(Organization).where(Organization.org_type == OrganizationType.EMPLOYER.value)).all()
        }

        for item in CAMPUS_DEMO_JOBS:
            org = org_by_name.get(item["org_name"])
            if not org:
                print(f"WARN: missing org {item['org_name']}", file=sys.stderr)
                continue

            exists = db.scalar(
                select(Job).where(
                    Job.organization_id == org.id,
                    Job.title == item["title"],
                    Job.status == JobStatus.PUBLISHED.value,
                )
            )
            if exists:
                stats["skipped"] += 1
                continue

            payload = {
                "organization_id": org.id,
                "title": item["title"],
                "description": item["description"],
                "location": item["location"],
                "employment_type": item["employment_type"],
                "work_mode": item["work_mode"],
                "salary_min": item["salary_min"],
                "salary_max": item["salary_max"],
                "salary_currency": "INR",
                "openings": item["openings"],
                "closes_on": CLOSES,
                "skills": item["skills"],
                "hiring_stages": ["Aptitude", "Technical interview", "HR interview", "Offer"],
                "requires_moderation": False,
                "eligibility": item["eligibility"],
            }
            job = job_service.create_job(db, admin, payload)
            seed_eligibility_from_payload(db, job, item["eligibility"])
            job_service.submit_job(db, job, admin)
            stats["created"] += 1

        db.commit()

        published = db.scalars(select(Job).where(Job.status == JobStatus.PUBLISHED.value)).all()
        print(json.dumps({**stats, "published_total": len(published)}, indent=2))
        for j in published:
            org = db.get(Organization, j.organization_id)
            print(f"  LIVE: {org.name if org else '?'} — {j.title}")
        return 0
    except Exception as exc:
        db.rollback()
        print(f"ERROR: {exc}", file=sys.stderr)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())