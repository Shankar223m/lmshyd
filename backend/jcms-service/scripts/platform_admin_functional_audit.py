#!/usr/bin/env python3
"""Phase 4 — Platform administrator functional audit."""

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
            json={"email": f"pem_{uid}@example.com", "password": PWD, "full_name": "E", "role": "EMPLOYER", "organization_name": f"PendCo {uid}"},
        )
        admin_t = admin_login(c)
        emp_t = login(c, f"pem_{uid}@example.com")
        row(ROWS, "Admin login", "/admin/dashboard", "POST /auth/login", "200", "ok" if admin_t else "fail", "PASS" if admin_t else "FAIL")
        if not admin_t or not emp_t:
            save_phase(
                ROWS,
                "platform_admin_functional_audit_results.json",
                "PLATFORM_ADMIN_COMPLETE_FUNCTIONAL_AUDIT.md",
                "Platform administrator complete functional audit",
                "platform_admin",
            )
            return 1

        org = c.get(f"{BASE}/auth/me", headers=H(emp_t)).json()["data"]["organization_id"]
        pending = c.get(f"{BASE}/admin/organizations?tab=PENDING", headers=H(admin_t))
        row(ROWS, "List pending orgs", "/admin/verification", "GET /admin/organizations", "200", str(pending.status_code), "PASS" if pending.status_code == 200 else "FAIL", pending="Review queue")

        v = c.post(f"{BASE}/admin/organizations/{org}/verify", json={"action": "verify", "comment": "ok"}, headers=H(admin_t))
        row(ROWS, "Approve organisation", "/admin/verification", "POST verify", "VERIFIED", v.json().get("data", {}).get("verification_status", "?"), "PASS" if v.status_code == 200 else "FAIL")

        job = c.post(f"{BASE}/jobs", json={"title": f"ModJob {uid}", "openings": 1, "requires_moderation": True}, headers=H(emp_t)).json()["data"]["id"]
        c.post(f"{BASE}/jobs/{job}/submit", headers=H(emp_t))
        mj = c.get(f"{BASE}/admin/jobs?tab=UNDER_REVIEW", headers=H(admin_t))
        row(ROWS, "Job moderation queue", "/admin/job-moderation", "GET /admin/jobs", "200", str(mj.status_code), "PASS" if mj.status_code == 200 else "FAIL", pending="Moderation")

        m = c.post(f"{BASE}/admin/jobs/{job}/moderate", json={"action": "approve", "note": "ok"}, headers=H(admin_t))
        row(ROWS, "Approve job", "/admin/job-moderation", "POST moderate", "PUBLISHED", m.json().get("data", {}).get("status", "?"), "PASS" if m.status_code == 200 else "FAIL")

        stats = c.get(f"{BASE}/admin/stats", headers=H(admin_t))
        row(ROWS, "Admin dashboard stats", "/admin/dashboard", "GET /admin/stats", "200", str(stats.status_code), "PASS" if stats.status_code == 200 else "FAIL")

        al = c.get(f"{BASE}/admin/audit-logs?limit=10", headers=H(admin_t))
        row(ROWS, "Audit logs", "/admin/audit", "GET /admin/audit-logs", "200", str(al.status_code), "PASS" if al.status_code == 200 else "FAIL")

        deny = c.get(f"{BASE}/admin/audit-logs", headers=H(emp_t))
        row(ROWS, "Non-admin audit denied", "/admin/audit", "GET audit", "403", str(deny.status_code), "PASS" if deny.status_code == 403 else "FAIL")

        row(ROWS, "User role assignment UI", "/admin/*", "N/A", "admin user mgmt", "not in API inventory", "NOT IMPLEMENTED")

    fails = save_phase(
        ROWS,
        "platform_admin_functional_audit_results.json",
        "PLATFORM_ADMIN_COMPLETE_FUNCTIONAL_AUDIT.md",
        "Platform administrator complete functional audit",
        "platform_admin",
    )
    with open(Path(__file__).resolve().parents[2] / "FUNCTIONAL_TESTING" / "PLATFORM_ADMIN_DEFECT_REGISTER.md", "w") as f:
        f.write("# Platform admin defect register\n\n")
        f.writelines(f"- {r['feature']}\n" for r in ROWS if r["result"] == "FAIL")
    return 1 if fails else 0


if __name__ == "__main__":
    raise SystemExit(main())
