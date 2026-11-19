#!/usr/bin/env python3
"""Grant every published catalog course to one institution (e.g. GenZ Test College).

Usage (from repo root, with stack DBs reachable):
  python backend/subscription-service/scripts/grant_all_published_courses_to_institution.py \\
    --institution-name "GenZ Test College"
"""

from __future__ import annotations

import argparse
import asyncio
import os
import uuid
from datetime import UTC, datetime, timedelta

import asyncpg


def _db_url(env_key: str, db_name: str, default_port: int) -> str:
    raw = os.getenv(env_key)
    if raw:
        return raw.replace("postgresql+asyncpg://", "postgresql://")
    return f"postgresql://lms:lms@127.0.0.1:{default_port}/{db_name}"


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--institution-name", default="GenZ Test College")
    parser.add_argument("--seats", type=int, default=500)
    parser.add_argument("--term-days", type=int, default=365)
    args = parser.parse_args()

    um_url = _db_url("USER_MANAGEMENT_DATABASE_URL", "lms_user_management", 5432)
    cat_url = _db_url("DATABASE_URL", "lms_catalog", 5432)
    sub_url = _db_url("SUBSCRIPTION_DATABASE_URL", "lms_subscription", 5432)

    um = await asyncpg.connect(um_url)
    try:
        inst = await um.fetchrow(
            "SELECT public_id, name FROM institutions WHERE LOWER(name) LIKE LOWER($1) ORDER BY created_at LIMIT 1",
            f"%{args.institution_name.strip()}%",
        )
        if inst is None:
            raise SystemExit(f"No institution matching name {args.institution_name!r}")
        org_id = int(inst["public_id"])
        print(f"Institution: {inst['name']} ({org_id})")
    finally:
        await um.close()

    course_ids: list[int] = []
    try:
        cat = await asyncpg.connect(cat_url)
        try:
            rows = await cat.fetch(
                """
                SELECT c.public_id
                FROM courses c
                WHERE c.archived_at IS NULL
                  AND EXISTS (
                    SELECT 1 FROM course_versions v
                    WHERE v.course_id = c.id AND v.status = 'published'
                  )
                """
            )
            course_ids = [int(r["public_id"]) for r in rows]
            print(f"Published courses (catalog DB): {len(course_ids)}")
        finally:
            await cat.close()
    except (asyncpg.InvalidCatalogNameError, OSError) as exc:
        print(f"Catalog DB unavailable ({exc!r}); using subscription course_refs instead.")

    sub = await asyncpg.connect(sub_url)
    if not course_ids:
        rows = await sub.fetch("SELECT course_id FROM course_refs ORDER BY course_id")
        course_ids = [int(r["course_id"]) for r in rows]
        print(f"Courses from course_refs: {len(course_ids)}")
    if not course_ids:
        raise SystemExit("No courses found. Start catalog-service or seed course_refs.")
    try:
        now = datetime.now(UTC)
        ends = now + timedelta(days=args.term_days)
        created = 0
        skipped = 0
        for cid in course_ids:
            exists = await sub.fetchrow(
                """
                SELECT id FROM subscriptions
                WHERE organization_id = $1 AND course_id = $2
                  AND status = 'active'
                  AND starts_at <= $3 AND ends_at > $3
                """,
                org_id,
                cid,
                now,
            )
            if exists:
                skipped += 1
                continue
            await sub.execute(
                """
                INSERT INTO subscriptions (
                  id, public_id, organization_id, course_id,
                  seats_total, seats_used, starts_at, ends_at,
                  status, created_at, updated_at
                ) VALUES (
                  $1, $2, $3, $4,
                  $5, 0, $6, $7,
                  'active', $6, $6
                )
                """,
                uuid.uuid4(),
                int.from_bytes(uuid.uuid4().bytes[:8], "big") % (10**18),
                org_id,
                cid,
                args.seats,
                now,
                ends,
            )
            created += 1
        print(f"Created subscriptions: {created}, skipped (already active): {skipped}")
    finally:
        await sub.close()


if __name__ == "__main__":
    asyncio.run(main())