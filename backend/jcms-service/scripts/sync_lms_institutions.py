#!/usr/bin/env python3
"""Mirror LMS institutions into JCMS (partner colleges for job assignment)."""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.core.database import SessionLocal
from app.modules.organizations.lms_sync import ensure_campus_institution_orgs, sync_institutions_from_user_management


def main() -> int:
    with SessionLocal() as db:
        count = sync_institutions_from_user_management(db)
        db.commit()
        ensure_campus_institution_orgs(db, force=True)
        db.commit()
        print(f"Synced {count} LMS institution(s) into JCMS.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())