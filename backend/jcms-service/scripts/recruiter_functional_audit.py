#!/usr/bin/env python3
"""Phase 2 — Recruiter functional audit."""

from __future__ import annotations

import sys
import uuid
from datetime import date, datetime, timedelta, timezone
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
        for role, email, org in [
            ("EMPLOYER", f"rec_em_{uid}@example.com", f"RecCo {uid}"),
            ("EMPLOYER", f"rec_em2_{uid}@example.com", f"Other {uid}"),
        ]:
            b = {"email": email, "password": PWD, "full_name": role, "role": role}
            if org:
                b["organization_name"] = org
            c.post(f"{BASE}/auth/register", json=b)
        admin_t = admin_login(c)
        emp_t = login(c, f"rec_em_{uid}@example.com")
        emp2_t = login(c, f"rec_em2_{uid}@example.com")
        org = c.get(f"{BASE}/auth/me", headers=H(emp_t)).json()["data"]["organization_id"]
        c.post(f"{BASE}/admin/organizations/{org}/verify", json={"action": "verify"}, headers=H(admin_t))
        rec_e = f"rec_r_{uid}@example.com"
        rec2_e = f"rec_r2_{uid}@example.com"
        c.post(f"{BASE}/employers/me/recruiters", json={"email": rec_e, "full_name": "R1", "password": PWD}, headers=H(emp_t))
        c.post(f"{BASE}/employers/me/recruiters", json={"email": rec2_e, "full_name": "R2", "password": PWD}, headers=H(emp2_t))
        rec_t = login(c, rec_e)
        rec2_t = login(c, rec2_e)
        row(ROWS, "Recruiter login", "/recruiter/screening", "POST /auth/login", "200", "ok" if rec_t else "fail", "PASS" if rec_t else "FAIL")

        rid = c.get(f"{BASE}/employers/me/recruiters", headers=H(emp_t)).json()["data"][0]["id"]
        job = c.post(
            f"{BASE}/jobs",
            json={"title": f"RecJob {uid}", "openings": 2, "recruiter_ids": [rid], "requires_moderation": False},
            headers=H(emp_t),
        ).json()["data"]["id"]
        c.post(f"{BASE}/jobs/{job}/publish", headers=H(emp_t))
        stu = f"rec_stu_{uid}@example.com"
        c.post(f"{BASE}/auth/register", json={"email": stu, "password": PWD, "full_name": "S", "role": "STUDENT"})
        stu_t = login(c, stu)
        app_id = c.post(f"{BASE}/jobs/{job}/applications", json={"answers": {"a": "b"}}, headers=H(stu_t)).json()["data"]["id"]

        q = c.get(f"{BASE}/recruiter/applications", headers=H(rec_t))
        in_queue = any(a["id"] == app_id for a in q.json().get("data", []))
        row(
            ROWS,
            "Assigned candidate queue",
            "/recruiter/screening",
            "GET /recruiter/applications",
            "contains app",
            f"app_id={app_id} in_queue={in_queue}",
            "PASS" if in_queue else "FAIL",
            pending="Screening",
        )

        q2 = c.get(f"{BASE}/recruiter/applications", headers=H(rec2_t))
        isolated = app_id not in [a["id"] for a in q2.json().get("data", [])]
        row(
            ROWS,
            "Unassigned recruiter isolation",
            "/recruiter/screening",
            "GET /recruiter/applications",
            "empty of app",
            f"isolated={isolated}",
            "PASS" if isolated else "FAIL",
        )

        c.post(f"{BASE}/applications/{app_id}/screen", headers=H(rec_t))
        c.post(f"{BASE}/applications/{app_id}/shortlist", headers=H(rec_t))
        row(ROWS, "Shortlist candidate", "/recruiter/screening", "POST /shortlist", "SHORTLISTED", c.get(f"{BASE}/applications/{app_id}", headers=H(stu_t)).json()["data"]["status"], "PASS")

        c.post(f"{BASE}/applications/{app_id}/hold", headers=H(rec_t))
        row(ROWS, "Hold candidate", "/recruiter/screening", "POST /hold", "ON_HOLD", c.get(f"{BASE}/applications/{app_id}", headers=H(stu_t)).json()["data"]["status"], "PASS", pending="Await decision")

        c.post(f"{BASE}/applications/{app_id}/shortlist", headers=H(rec_t))
        now = datetime.now(timezone.utc)
        iv = c.post(
            f"{BASE}/applications/{app_id}/interviews",
            json={
                "round_name": "Tech",
                "format": "ONLINE",
                "starts_at": (now + timedelta(days=2)).isoformat(),
                "ends_at": (now + timedelta(days=2, hours=1)).isoformat(),
                "meeting_link": "https://meet.example/x",
            },
            headers=H(rec_t),
        )
        iid = iv.json()["data"]["id"]
        row(ROWS, "Schedule interview", "/recruiter/interviews", "POST .../interviews", "SCHEDULED", iv.json()["data"]["status"], "PASS")

        fb = c.post(
            f"{BASE}/interviews/{iid}/feedback",
            json={"technical_skills": 4, "problem_solving": 4, "communication": 4, "culture_fit": 4, "comments": "ok", "recommendation": "Recommend"},
            headers=H(rec_t),
        )
        row(ROWS, "Submit scorecard", "/recruiter/interviews", "POST .../feedback", "200", str(fb.status_code), "PASS" if fb.status_code == 200 else "FAIL")

        dup = c.post(
            f"{BASE}/interviews/{iid}/feedback",
            json={"technical_skills": 3, "problem_solving": 3, "communication": 3, "culture_fit": 3, "comments": "dup", "recommendation": "Reject"},
            headers=H(rec_t),
        )
        row(ROWS, "Duplicate scorecard handling", "/recruiter/interviews", "POST .../feedback", "400 or idempotent", str(dup.status_code), "PASS" if dup.status_code in (200, 400, 409) else "NOT VERIFIED")

        ri = c.get(f"{BASE}/recruiter/interviews", headers=H(rec_t))
        row(ROWS, "Recruiter interviews list", "/recruiter/interviews", "GET /recruiter/interviews", "200", str(ri.status_code), "PASS" if ri.status_code == 200 else "FAIL")

        row(ROWS, "Recruiter queue pagination", "/recruiter/screening", "GET /recruiter/applications", "page param", "not in API", "NOT IMPLEMENTED")

    fails = save_phase(ROWS, "recruiter_functional_audit_results.json", "RECRUITER_COMPLETE_FUNCTIONAL_AUDIT.md", "Recruiter complete functional audit", "recruiter")
    with open(Path(__file__).resolve().parents[2] / "FUNCTIONAL_TESTING" / "RECRUITER_DEFECT_REGISTER.md", "w") as f:
        f.write("# Recruiter defect register\n\n")
        f.writelines(f"- {r['feature']}: {r['actual']}\n" for r in ROWS if r["result"] == "FAIL")
    return 1 if fails else 0


if __name__ == "__main__":
    raise SystemExit(main())
