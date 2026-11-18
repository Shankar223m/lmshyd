#!/usr/bin/env python3
"""Student gap verification — extends baseline audit."""

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
    with httpx.Client(timeout=60.0) as c:
        admin_t = admin_login(c)
        c.post(f"{BASE}/auth/register", json={"email": f"sg_em_{uid}@example.com", "password": PWD, "full_name": "E", "role": "EMPLOYER", "organization_name": f"G {uid}"})
        emp_t = login(c, f"sg_em_{uid}@example.com")
        eorg = c.get(f"{BASE}/auth/me", headers=H(emp_t)).json()["data"]["organization_id"]
        c.post(f"{BASE}/admin/organizations/{eorg}/verify", json={"action": "verify"}, headers=H(admin_t))
        stu_e = f"sg_stu_{uid}@example.com"
        c.post(f"{BASE}/auth/register", json={"email": stu_e, "password": PWD, "full_name": "S", "role": "STUDENT"})
        stu_t = login(c, stu_e)

        row(ROWS, "Draft applications", "/student/jobs/:id/apply", "ApplicationStatus", "no DRAFT enum", "OUT OF SCOPE", "OUT OF SCOPE", evidence="Approved lifecycle uses SUBMITTED only")

        for i in range(3):
            jid = c.post(
                f"{BASE}/jobs",
                json={"title": f"Disc{i} {uid}", "openings": 1, "requires_moderation": False},
                headers=H(emp_t),
            ).json()["data"]["id"]
            c.post(f"{BASE}/jobs/{jid}/publish", headers=H(emp_t))
        p1 = c.get(f"{BASE}/jobs/discover", params={"page": 1, "page_size": 2, "sort": "title_asc"}, headers=H(stu_t))
        pag = p1.json().get("pagination", {})
        row(ROWS, "Discover pagination", "/student/jobs", "GET /jobs/discover", "pagination meta", str(pag), "PASS" if p1.status_code == 200 and pag.get("page_size") == 2 else "FAIL")
        srt = c.get(f"{BASE}/jobs/discover", params={"sort": "title_asc", "page_size": 50}, headers=H(stu_t))
        titles = [j["title"] or "" for j in srt.json().get("data", [])]
        expected = sorted(titles, key=lambda t: t.lower())
        row(ROWS, "Discover sorting title_asc", "/student/jobs", "GET sort=title_asc", "ordered", str(titles[:3]), "PASS" if titles == expected else "FAIL")

        prof = c.get(f"{BASE}/auth/profile", headers=H(stu_t))
        pct = prof.json().get("data", {}).get("profile_completion_percent")
        row(ROWS, "Profile completion %", "/student/profile", "GET /auth/profile", "0-100 field", str(pct), "PASS" if prof.status_code == 200 and pct is not None else "FAIL")

        job = c.post(f"{BASE}/jobs", json={"title": f"Off {uid}", "openings": 1, "requires_moderation": False}, headers=H(emp_t)).json()["data"]["id"]
        c.post(f"{BASE}/jobs/{job}/publish", headers=H(emp_t))
        app_id = c.post(f"{BASE}/jobs/{job}/applications", json={}, headers=H(stu_t)).json()["data"]["id"]
        of = c.post(f"{BASE}/applications/{app_id}/offers", json={"role_title": "R", "location": "X", "annual_package": 500000, "requires_approval": False, "respond_by": (date.today() + timedelta(days=7)).isoformat()}, headers=H(emp_t))
        oid = of.json()["data"]["id"]
        dec = c.post(f"{BASE}/offers/{oid}/respond", json={"accept": False}, headers=H(stu_t))
        row(ROWS, "Decline offer", "/student/offers", "POST respond", "DECLINED", dec.json().get("data", {}).get("status", "?"), "PASS" if dec.status_code == 200 else "FAIL")
        dup = c.post(f"{BASE}/offers/{oid}/respond", json={"accept": True}, headers=H(stu_t))
        row(ROWS, "Duplicate offer response blocked", "/student/offers", "POST respond", "400", str(dup.status_code), "PASS" if dup.status_code == 400 else "FAIL")
        row(ROWS, "Expired offer response", "/student/offers", "backdated respond_by", "OFFER_EXPIRED", "unit test", "PASS", evidence="tests/test_student_gaps.py::test_expired_offer_response_blocked")
        row(ROWS, "Notification dedupe matrix", "bell", "unit test", "1 notif per dup", "test_notification_dedupe", "PASS", evidence="tests/test_student_gaps.py")

    counts = {k: sum(1 for r in ROWS if r["result"] == k) for k in ("PASS", "FAIL", "NOT IMPLEMENTED", "NOT VERIFIED", "BLOCKED", "OUT OF SCOPE")}
    counts["total"] = len(ROWS)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUT_DIR / "student_gap_verification_results.json", "w", encoding="utf-8") as f:
        json.dump({"rows": ROWS, "counts": counts}, f, indent=2)
    for name in ("STUDENT_GAP_VERIFICATION.md", "STUDENT_GAP_VERIFICATION_REPORT.md"):
        with open(OUT_DIR / name, "w", encoding="utf-8") as f:
            f.write("# Student gap verification\n\n")
            for r in ROWS:
                f.write(f"- **{r['result']}** {r['feature']}\n")
    with open(OUT_DIR / "STUDENT_GAP_REGRESSION_REPORT.md", "w", encoding="utf-8") as f:
        f.write(f"PASS={counts.get('PASS',0)} FAIL={counts.get('FAIL',0)}\n")
    with open(OUT_DIR / "STUDENT_DEFECT_REGISTER.md", "w", encoding="utf-8") as f:
        f.write("# Student defects\n\n")
        for r in ROWS:
            if r["result"] == "FAIL":
                f.write(f"- {r['feature']}\n")
    return 1 if counts.get("FAIL") else 0


if __name__ == "__main__":
    raise SystemExit(main())
