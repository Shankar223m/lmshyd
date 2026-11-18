"""Collapse duplicate PUBLISHED jobs that share organization_id + title (keep newest).

Usage (container):
  PYTHONPATH=/app python /app/scripts/dedupe_published_jobs.py
"""

from __future__ import annotations

from collections import defaultdict

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.entities import Job
from app.shared.enums import JobStatus


def main() -> None:
    db = SessionLocal()
    try:
        jobs = db.scalars(
            select(Job)
            .where(Job.status == JobStatus.PUBLISHED.value)
            .order_by(Job.created_at.desc())
        ).all()
        by_key: dict[tuple[str, str], list[Job]] = defaultdict(list)
        for job in jobs:
            key = (str(job.organization_id), (job.title or "").strip().lower())
            by_key[key].append(job)

        closed = 0
        for group in by_key.values():
            if len(group) < 2:
                continue
            # Newest first from query order; keep [0], close the rest.
            for dup in group[1:]:
                dup.status = JobStatus.CLOSED.value
                closed += 1
        db.commit()
        print(f"dedupe_published_jobs: closed={closed} kept_groups={len(by_key)}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
