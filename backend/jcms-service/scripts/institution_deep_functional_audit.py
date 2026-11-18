#!/usr/bin/env python3
"""Institution deep functional audit (jcms_test)."""

from __future__ import annotations

import json
import sys
import uuid
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import httpx
from audit_lib import BASE, H, OUT_DIR, PWD, admin_login, flush_redis_rate_limits, login, row, verify_qa_db

ROWS: list = []


def main() -> int:
    if not verify_qa_db()[0]:
        return 2
    flush_redis_rate_limits()
    uid = uuid.uuid4().hex[:8]
    with httpx.Client(timeout=90.0) as c:
        c.post(f"{BASE}/auth/register", json={"email": f"id_i1_{uid}@example.com", "password": PWD, "full_name": "I1", "role": "INSTITUTION", "organization_name": f"C1 {uid}"})
        c.post(f"{BASE}/auth/register", json={"email": f"id_i2_{uid}@example.com", "password": PWD, "full_name": "I2", "role": "INSTITUTION", "organization_name": f"C2 {uid}"})
        c.post(f"{BASE}/auth/register", json={"email": f"id_em_{uid}@example.com", "password": PWD, "full_name": "E", "role": "EMPLOYER", "organization_name": f"Co {uid}"})
        admin_t = admin_login(c)
        i1_t = login(c, f"id_i1_{uid}@example.com")
        i2_t = login(c, f"id_i2_{uid}@example.com")
        emp_t = login(c, f"id_em_{uid}@example.com")
        iorg = c.get(f"{BASE}/auth/me", headers=H(i1_t)).json()["data"]["organization_id"]
        c.post(f"{BASE}/admin/organizations/{iorg}/verify", json={"action": "verify"}, headers=H(admin_t))
        eorg = c.get(f"{BASE}/auth/me", headers=H(emp_t)).json()["data"]["organization_id"]
        c.post(f"{BASE}/admin/organizations/{eorg}/verify", json={"action": "verify"}, headers=H(admin_t))

        row(ROWS, "Institution login", "/institution/students", "POST /auth/login", "200", "ok" if i1_t else "fail", "PASS" if i1_t else "FAIL")
        emp_denied = c.get(f"{BASE}/institutions/me/students", headers=H(emp_t))
        row(ROWS, "Student denied institution API", "/institution/students", "GET /students", "403", str(emp_denied.status_code), "PASS" if emp_denied.status_code == 403 else "FAIL")

        batch_rows = [{"email": f"id_bulk_{i}_{uid}@example.com", "full_name": f"S{i}", "password": PWD, "program": "B.Tech", "graduation_year": "2026"} for i in range(25)]
        bulk = c.post(f"{BASE}/institutions/me/students/import", json={"rows": batch_rows}, headers=H(i1_t))
        row(ROWS, "Large batch import (25 rows)", "/institution/students", "POST /import", "created=25", str(bulk.json().get("data")), "PASS" if bulk.status_code == 200 and bulk.json()["data"]["created"] == 25 else "FAIL")

        mixed = c.post(
            f"{BASE}/institutions/me/students/import",
            json={"rows": [{"email": f"id_bulk_0_{uid}@example.com", "full_name": "Dup"}, {"email": "bad", "full_name": "", "program": ""}]},
            headers=H(i1_t),
        )
        d = mixed.json().get("data", {})
        row(ROWS, "Partial import dup+invalid", "/institution/students", "POST /import", "skipped>=2", str(d), "PASS" if mixed.status_code == 200 and len(d.get("skipped", [])) >= 2 else "FAIL")

        prev = c.post(f"{BASE}/institutions/me/students/import/preview", json={"rows": [{"email": "x@y.com", "full_name": "", "program": ""}]}, headers=H(i1_t))
        row(ROWS, "Preview validation errors", "/institution/students", "POST /preview", "errors", str(len(prev.json().get("data", {}).get("errors", []))), "PASS" if prev.status_code == 200 else "FAIL")

        search = c.get(f"{BASE}/institutions/me/students", params={"q": "id_bulk_1", "page": 1, "page_size": 5}, headers=H(i1_t))
        pag = search.json().get("pagination", {})
        row(ROWS, "Student search + pagination", "/institution/students", "GET /students", "pagination meta", str(pag.get("total_items", 0)), "PASS" if search.status_code == 200 and pag.get("page") == 1 else "FAIL")

        i2_list = c.get(f"{BASE}/institutions/me/students", headers=H(i2_t))
        row(ROWS, "Cross-institution roster isolation", "/institution/students", "GET /students", "empty or own only", str(len(i2_list.json().get("data", []))), "PASS" if len(i2_list.json().get("data", [])) == 0 else "FAIL")

        stu_em = f"id_pl_stu_{uid}@example.com"
        c.post(f"{BASE}/institutions/me/students/import", json={"rows": [{"email": stu_em, "full_name": "Pl", "password": PWD, "program": "B.Tech", "graduation_year": "2026"}]}, headers=H(i1_t))
        stu_t = login(c, stu_em)
        job = c.post(f"{BASE}/jobs", json={"title": f"PlJob {uid}", "openings": 1, "requires_moderation": False}, headers=H(emp_t)).json()["data"]["id"]
        c.post(f"{BASE}/jobs/{job}/publish", headers=H(emp_t))
        app_id = c.post(f"{BASE}/jobs/{job}/applications", json={}, headers=H(stu_t)).json()["data"]["id"]
        of = c.post(f"{BASE}/applications/{app_id}/offers", json={"role_title": "Dev", "location": "X", "annual_package": 600000, "requires_approval": False}, headers=H(emp_t))
        oid = of.json()["data"]["id"]
        c.post(f"{BASE}/offers/{oid}/respond", json={"accept": True}, headers=H(stu_t))
        pl = c.get(f"{BASE}/institutions/me/placements", headers=H(i1_t))
        row(ROWS, "Placement queue after offer accept", "/institution/placements", "GET /placements", "200", str(pl.status_code), "PASS" if pl.status_code == 200 else "FAIL")
        placements = pl.json().get("data", {})
        items = placements.get("items") if isinstance(placements, dict) else placements
        if isinstance(placements, dict) and "placements" in placements:
            items = placements["placements"]
        if not isinstance(items, list):
            items = placements if isinstance(placements, list) else []
        pid = items[0]["id"] if items else None
        if pid:
            ev = c.post(f"{BASE}/placements/{pid}/evidence", json={"designation": "Dev", "annual_package": 600000, "work_location": "X"}, headers=H(stu_t))
            vf = c.post(f"{BASE}/institutions/me/placements/{pid}/verify", json={"action": "verify"}, headers=H(i1_t))
            row(ROWS, "Institution verify placement", "/institution/placements", "POST verify", "200", str(vf.status_code), "PASS" if vf.status_code == 200 else "FAIL")
            cross = c.post(f"{BASE}/institutions/me/placements/{pid}/verify", json={"action": "verify"}, headers=H(i2_t))
            row(ROWS, "Cross-institution verify blocked", "/institution/placements", "POST verify", "403/404", str(cross.status_code), "PASS" if cross.status_code in (403, 404) else "FAIL")
        else:
            row(ROWS, "Institution verify placement", "/institution/placements", "POST verify", "placement id", "none", "FAIL")

        an = c.get(f"{BASE}/institutions/me/analytics", headers=H(i1_t))
        row(ROWS, "Analytics metrics", "/institution/analytics", "GET /analytics", "data", str(an.status_code), "PASS" if an.status_code == 200 else "FAIL")

    counts = {k: sum(1 for r in ROWS if r["result"] == k) for k in ("PASS", "FAIL", "NOT IMPLEMENTED", "NOT VERIFIED", "BLOCKED")}
    counts["total"] = len(ROWS)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUT_DIR / "institution_deep_audit_results.json", "w", encoding="utf-8") as f:
        json.dump({"phase": "institution_deep", "database": "jcms_test", "rows": ROWS, "counts": counts}, f, indent=2)
    with open(OUT_DIR / "INSTITUTION_DEEP_FUNCTIONAL_AUDIT.md", "w", encoding="utf-8") as f:
        f.write("# Institution deep functional audit\n\n")
        for r in ROWS:
            f.write(f"- **{r['result']}** {r['feature']}: {r['actual']}\n")
    with open(OUT_DIR / "INSTITUTION_REGRESSION_REPORT.md", "w", encoding="utf-8") as f:
        f.write(f"# Institution regression\n\nPASS={counts['PASS']} FAIL={counts['FAIL']}\n\nCommand: `python backend/scripts/institution_deep_functional_audit.py`\n")
    fails = [r for r in ROWS if r["result"] == "FAIL"]
    with open(OUT_DIR / "INSTITUTION_DEFECT_REGISTER.md", "w", encoding="utf-8") as f:
        f.write("# Institution defect register\n\n")
        if fails:
            for r in fails:
                f.write(f"- {r['feature']}: {r['actual']}\n")
        else:
            f.write("No FAIL in latest deep audit.\n")
    return 1 if counts.get("FAIL") else 0


if __name__ == "__main__":
    raise SystemExit(main())
