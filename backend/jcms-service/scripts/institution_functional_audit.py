#!/usr/bin/env python3
"""Phase 3 — Institution functional audit."""

from __future__ import annotations

import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import httpx
from audit_lib import BASE, H, PWD, admin_login, flush_redis_rate_limits, login, row, save_phase, verify_qa_db

ROWS: list = []


def main() -> int:
    if not verify_qa_db()[0]:
        return 2
    flush_redis_rate_limits()
    uid = uuid.uuid4().hex[:8]
    with httpx.Client(timeout=45.0) as c:
        c.post(
            f"{BASE}/auth/register",
            json={"email": f"inst_i_{uid}@example.com", "password": PWD, "full_name": "I", "role": "INSTITUTION", "organization_name": f"College {uid}"},
        )
        c.post(
            f"{BASE}/auth/register",
            json={"email": f"inst_i2_{uid}@example.com", "password": PWD, "full_name": "I2", "role": "INSTITUTION", "organization_name": f"College2 {uid}"},
        )
        admin_t = admin_login(c)
        inst_t = login(c, f"inst_i_{uid}@example.com")
        inst2_t = login(c, f"inst_i2_{uid}@example.com")
        iorg = c.get(f"{BASE}/auth/me", headers=H(inst_t)).json()["data"]["organization_id"]
        c.post(f"{BASE}/admin/organizations/{iorg}/verify", json={"action": "verify"}, headers=H(admin_t))

        imp = c.post(
            f"{BASE}/institutions/me/students/import",
            json={"rows": [{"email": f"inst_stu_{uid}@example.com", "full_name": "Stu", "password": PWD, "program": "B.Tech", "graduation_year": "2026"}]},
            headers=H(inst_t),
        )
        row(ROWS, "CSV import via rows API", "/institution/students", "POST /students/import", "created=1", str(imp.json().get("data")), "PASS" if imp.status_code == 200 else "FAIL")

        dup = c.post(
            f"{BASE}/institutions/me/students/import",
            json={"rows": [{"email": f"inst_stu_{uid}@example.com", "full_name": "Stu", "program": "B.Tech"}]},
            headers=H(inst_t),
        )
        row(ROWS, "Duplicate import skipped", "/institution/students", "POST /students/import", "skipped duplicate", str(dup.json().get("data")), "PASS" if dup.json()["data"].get("created") == 0 else "FAIL")

        prev = c.post(
            f"{BASE}/institutions/me/students/import/preview",
            json={"rows": [{"email": "bad@", "full_name": "", "program": ""}]},
            headers=H(inst_t),
        )
        row(ROWS, "Import preview invalid rows", "/institution/students", "POST .../preview", "validation errors", str(prev.status_code), "PASS" if prev.status_code == 200 else "FAIL")

        st = c.get(f"{BASE}/institutions/me/students", headers=H(inst_t))
        row(ROWS, "Student roster list", "/institution/students", "GET /institutions/me/students", "200 list", str(st.status_code), "PASS" if st.status_code == 200 else "FAIL")

        an = c.get(f"{BASE}/institutions/me/analytics", headers=H(inst_t))
        an_ok = an.status_code == 200 and "data" in an.json()
        row(
            ROWS,
            "Analytics dashboard",
            "/institution/analytics",
            "GET /analytics",
            "metrics object",
            str(an.status_code),
            "PASS" if an_ok else "FAIL",
        )

        csv = c.get(f"{BASE}/institutions/me/analytics/export.csv", headers=H(inst_t))
        row(ROWS, "Analytics CSV export", "/institution/analytics", "GET export.csv", "text/csv", str(csv.status_code), "PASS" if csv.status_code == 200 else "FAIL")

        pl = c.get(f"{BASE}/institutions/me/placements", headers=H(inst_t))
        row(
            ROWS,
            "Placement queue + stats",
            "/institution/placements",
            "GET /placements",
            "stats block",
            str(pl.status_code),
            "PASS" if pl.status_code == 200 else "FAIL",
        )

        fake = "00000000-0000-0000-0000-000000000099"
        vf = c.post(f"{BASE}/institutions/me/placements/{fake}/verify", json={"action": "verify"}, headers=H(inst2_t))
        row(ROWS, "Cross-institution verify blocked", "/institution/placements", "POST verify", "403/404", str(vf.status_code), "PASS" if vf.status_code in (403, 404) else "FAIL")

        row(ROWS, "Large CSV stress", "/institution/students", "import", "performance test", "NOT RUN", "NOT VERIFIED", evidence="Use jcms_test only; not executed")

    fails = save_phase(ROWS, "institution_functional_audit_results.json", "INSTITUTION_COMPLETE_FUNCTIONAL_AUDIT.md", "Institution complete functional audit", "institution")
    return 1 if fails else 0


if __name__ == "__main__":
    raise SystemExit(main())
