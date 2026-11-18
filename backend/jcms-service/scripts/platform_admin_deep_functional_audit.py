#!/usr/bin/env python3
"""Platform admin deep functional audit (jcms_test)."""

from __future__ import annotations

import json
import sys
import uuid
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
    with httpx.Client(timeout=60.0) as c:
        admin_t = admin_login(c)
        row(ROWS, "Admin login", "/admin/dashboard", "POST /auth/login", "200", "ok" if admin_t else "fail", "PASS" if admin_t else "FAIL")
        c.post(f"{BASE}/auth/register", json={"email": f"pad_em_{uid}@example.com", "password": PWD, "full_name": "E", "role": "EMPLOYER", "organization_name": f"Pend {uid}"})
        emp_t = login(c, f"pad_em_{uid}@example.com")
        org = c.get(f"{BASE}/auth/me", headers=H(emp_t)).json()["data"]["organization_id"]
        pending = c.get(f"{BASE}/admin/organizations/pending", headers=H(admin_t))
        row(ROWS, "Pending orgs list", "/admin/verification", "GET /organizations/pending", "200", str(pending.status_code), "PASS" if pending.status_code == 200 else "FAIL")
        v = c.post(f"{BASE}/admin/organizations/{org}/verify", json={"action": "verify", "comment": "ok"}, headers=H(admin_t))
        row(ROWS, "Approve organisation", "/admin/verification", "POST verify", "VERIFIED", v.json().get("data", {}).get("verification_status", "?"), "PASS" if v.status_code == 200 else "FAIL")
        job = c.post(f"{BASE}/jobs", json={"title": f"Mod {uid}", "openings": 1, "requires_moderation": True}, headers=H(emp_t)).json()["data"]["id"]
        c.post(f"{BASE}/jobs/{job}/submit", headers=H(emp_t))
        rej = c.post(f"{BASE}/admin/jobs/{job}/moderate", json={"action": "reject", "note": "Incomplete JD"}, headers=H(admin_t))
        row(ROWS, "Reject job with note", "/admin/job-moderation", "POST moderate", "REJECTED", rej.json().get("data", {}).get("status", "?"), "PASS" if rej.status_code == 200 else "FAIL")
        job2 = c.post(f"{BASE}/jobs", json={"title": f"Ok {uid}", "openings": 1, "requires_moderation": True}, headers=H(emp_t)).json()["data"]["id"]
        c.post(f"{BASE}/jobs/{job2}/submit", headers=H(emp_t))
        ap = c.post(f"{BASE}/admin/jobs/{job2}/moderate", json={"action": "approve", "note": "ok"}, headers=H(admin_t))
        row(ROWS, "Approve job", "/admin/job-moderation", "POST moderate", "PUBLISHED", ap.json().get("data", {}).get("status", "?"), "PASS" if ap.status_code == 200 else "FAIL")
        al = c.get(f"{BASE}/admin/audit-logs", params={"limit": 10, "resource_type": "job"}, headers=H(admin_t))
        row(ROWS, "Audit logs filter", "/admin/audit", "GET /audit-logs", "200", str(al.status_code), "PASS" if al.status_code == 200 else "FAIL")
        deny = c.get(f"{BASE}/admin/stats", headers=H(emp_t))
        row(ROWS, "Employer denied admin stats", "/admin/dashboard", "GET /admin/stats", "403", str(deny.status_code), "PASS" if deny.status_code == 403 else "FAIL")
        row(ROWS, "User role management API", "/admin/*", "N/A", "RBAC user admin", "not in backend inventory", "OUT OF SCOPE", evidence="ROLE_ACCESS_MATRIX: admin governs org/job moderation only")

    counts = {k: sum(1 for r in ROWS if r["result"] == k) for k in ("PASS", "FAIL", "NOT IMPLEMENTED", "NOT VERIFIED", "BLOCKED", "OUT OF SCOPE")}
    counts["total"] = len(ROWS)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUT_DIR / "platform_admin_deep_audit_results.json", "w", encoding="utf-8") as f:
        json.dump({"phase": "platform_admin_deep", "rows": ROWS, "counts": counts}, f, indent=2)
    with open(OUT_DIR / "PLATFORM_ADMIN_DEEP_FUNCTIONAL_AUDIT.md", "w", encoding="utf-8") as f:
        f.write("# Platform admin deep audit\n\n")
        for r in ROWS:
            f.write(f"- **{r['result']}** {r['feature']}: {r['actual']}\n")
    with open(OUT_DIR / "PLATFORM_ADMIN_REGRESSION_REPORT.md", "w", encoding="utf-8") as f:
        f.write(f"PASS={counts.get('PASS',0)} FAIL={counts.get('FAIL',0)}\n")
    with open(OUT_DIR / "PLATFORM_ADMIN_DEFECT_REGISTER.md", "w", encoding="utf-8") as f:
        f.write("# Platform admin defects\n\n")
        for r in ROWS:
            if r["result"] == "FAIL":
                f.write(f"- {r['feature']}\n")
    return 1 if counts.get("FAIL") else 0


if __name__ == "__main__":
    raise SystemExit(main())
