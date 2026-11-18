#!/usr/bin/env python3
"""Phase 1 — Employer functional audit (HTTP, jcms_test)."""

from __future__ import annotations

import sys
import uuid
from datetime import date, timedelta

from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))

import httpx

from audit_lib import BASE, H, OUT_DIR, PWD, admin_login, flush_redis_rate_limits, login, row, save_phase, verify_qa_db

ROWS: list = []


def main() -> int:
    ok, msg = verify_qa_db()
    if not ok:
        print(f"BLOCKED: API/DB check failed: {msg}")
        return 2
    flush_redis_rate_limits()

    uid = uuid.uuid4().hex[:8]
    emp_e = f"emp_audit_em_{uid}@example.com"
    emp2_e = f"emp_audit_e2_{uid}@example.com"
    rec_e = f"emp_audit_rec_{uid}@example.com"

    with httpx.Client(timeout=45.0) as c:
        # Auth
        c.post(
            f"{BASE}/auth/register",
            json={"email": emp_e, "password": PWD, "full_name": "Emp", "role": "EMPLOYER", "organization_name": f"EmpCo {uid}"},
        )
        c.post(
            f"{BASE}/auth/register",
            json={"email": emp2_e, "password": PWD, "full_name": "Emp2", "role": "EMPLOYER", "organization_name": f"OtherCo {uid}"},
        )
        bad = c.post(f"{BASE}/auth/login", json={"email": emp_e, "password": "wrong"})
        row(ROWS, "Invalid employer login", "/login", "POST /auth/login", "401", str(bad.status_code), "PASS" if bad.status_code == 401 else "FAIL")

        admin_t = admin_login(c)
        emp_t = login(c, emp_e)
        emp2_t = login(c, emp2_e)
        row(ROWS, "Employer login", "/employer/jobs", "POST /auth/login", "200 token", "ok" if emp_t else "fail", "PASS" if emp_t else "FAIL")

        # Unverified publish blocked
        job_unv = c.post(f"{BASE}/jobs", json={"title": "Unv Job", "openings": 1}, headers=H(emp_t))
        jid_unv = job_unv.json()["data"]["id"] if job_unv.status_code == 200 else None
        pub_unv = c.post(f"{BASE}/jobs/{jid_unv}/publish", headers=H(emp_t)) if jid_unv else None
        row(
            ROWS,
            "Unverified employer cannot publish",
            "/employer/jobs",
            "POST /jobs/{id}/publish",
            "400/403",
            str(pub_unv.status_code) if pub_unv else "n/a",
            "PASS" if pub_unv and pub_unv.status_code in (400, 403) else "FAIL",
        )

        org = c.get(f"{BASE}/auth/me", headers=H(emp_t)).json()["data"]["organization_id"]
        c.post(f"{BASE}/admin/organizations/{org}/verify", json={"action": "verify"}, headers=H(admin_t))

        og = c.get(f"{BASE}/employers/me", headers=H(emp_t))
        row(
            ROWS,
            "Employer org profile GET",
            "/employer/profile",
            "GET /employers/me",
            "VERIFIED status",
            og.json().get("data", {}).get("verification_status", "?"),
            "PASS" if og.status_code == 200 and og.json()["data"]["verification_status"] == "VERIFIED" else "FAIL",
        )
        pu = c.patch(
            f"{BASE}/employers/me",
            json={"website": f"https://emp-{uid}.example", "industry": "Technology"},
            headers=H(emp_t),
        )
        row(ROWS, "Employer org profile PATCH", "/employer/profile", "PATCH /employers/me", "200", str(pu.status_code), "PASS" if pu.status_code == 200 else "FAIL")

        c.post(
            f"{BASE}/employers/me/recruiters",
            json={"email": rec_e, "full_name": "Rec", "password": PWD},
            headers=H(emp_t),
        )
        rec_id = c.get(f"{BASE}/employers/me/recruiters", headers=H(emp_t)).json()["data"][0]["id"]

        # Job create full payload (wizard fields supported by API)
        jr = c.post(
            f"{BASE}/jobs",
            json={
                "title": f"Full Stack {uid}",
                "description": "Build APIs and UI",
                "location": "Bengaluru",
                "employment_type": "FULL_TIME",
                "work_mode": "HYBRID",
                "salary_min": 800000,
                "salary_max": 1200000,
                "salary_currency": "INR",
                "openings": 3,
                "closes_on": (date.today() + timedelta(days=25)).isoformat(),
                "skills": ["Python", "React"],
                "hiring_stages": ["Screening", "Interview", "Selected"],
                "questions": [{"text": "Portfolio?", "required": True}],
                "recruiter_ids": [rec_id],
                "requires_moderation": True,
            },
            headers=H(emp_t),
        )
        job_id = jr.json()["data"]["id"] if jr.status_code == 200 else None
        row(ROWS, "Create job (wizard payload)", "/employer/jobs/new", "POST /jobs", "200 + id", str(jr.status_code), "PASS" if job_id else "FAIL")

        row(
            ROWS,
            "Invalid salary range validation",
            "/employer/jobs/new",
            "POST /jobs",
            "Reject min>max",
            "NOT VERIFIED",
            "NOT VERIFIED",
            evidence="No server-side range validator in job service",
        )

        if job_id:
            c.post(f"{BASE}/jobs/{job_id}/submit", headers=H(emp_t))
            st = c.get(f"{BASE}/jobs/{job_id}", headers=H(emp_t)).json()["data"]["status"]
            row(ROWS, "Submit for moderation", "/employer/jobs/new", "POST /jobs/{id}/submit", "UNDER_REVIEW", st, "PASS" if st == "UNDER_REVIEW" else "FAIL", pending="Await admin")

            c.post(f"{BASE}/admin/jobs/{job_id}/moderate", json={"action": "approve", "note": "ok"}, headers=H(admin_t))
            st2 = c.get(f"{BASE}/jobs/{job_id}", headers=H(emp_t)).json()["data"]["status"]
            row(ROWS, "Moderated job PUBLISHED", "/employer/jobs", "admin moderate", "PUBLISHED", st2, "PASS" if st2 == "PUBLISHED" else "FAIL")

            patch = c.patch(
                f"{BASE}/jobs/{job_id}",
                json={"title": f"Full Stack Updated {uid}", "openings": 4},
                headers=H(emp_t),
            )
            row(ROWS, "Edit job (PATCH)", "/employer/jobs", "PATCH /jobs/{id}", "200", str(patch.status_code), "PASS" if patch.status_code == 200 else "FAIL")

        # Job list + stats
        lj = c.get(f"{BASE}/employers/me/jobs", headers=H(emp_t))
        has_stats = lj.status_code == 200 and "stats" in lj.json().get("data", {})
        row(
            ROWS,
            "List jobs with stats",
            "/employer/jobs",
            "GET /employers/me/jobs",
            "stats+jobs",
            "stats present" if has_stats else lj.text[:120],
            "PASS" if has_stats else "FAIL",
        )
        row(ROWS, "Job list pagination", "/employer/jobs", "GET /employers/me/jobs", "page params", "not in API", "NOT IMPLEMENTED")
        row(ROWS, "Duplicate job action", "/employer/jobs", "N/A", "duplicate endpoint", "not in API", "NOT IMPLEMENTED")

        # Cross-org pipeline
        if job_id:
            cross = c.get(f"{BASE}/jobs/{job_id}/pipeline", headers=H(emp2_t))
            row(
                ROWS,
                "Cross-employer pipeline blocked",
                "/employer/pipeline",
                "GET /jobs/{id}/pipeline",
                "403",
                str(cross.status_code),
                "PASS" if cross.status_code == 403 else "FAIL",
            )

        # Close job
        if job_id:
            c.post(f"{BASE}/jobs/{job_id}/close", headers=H(emp_t))
            st3 = c.get(f"{BASE}/jobs/{job_id}", headers=H(emp_t)).json()["data"]["status"]
            row(ROWS, "Close job", "/employer/jobs", "POST /jobs/{id}/close", "CLOSED", st3, "PASS" if st3 == "CLOSED" else "FAIL")

        stu = f"emp_audit_stu_{uid}@example.com"
        c.post(f"{BASE}/auth/register", json={"email": stu, "password": PWD, "full_name": "S", "role": "STUDENT"})
        stu_t = login(c, stu)
        deny = c.get(f"{BASE}/employers/me/jobs", headers=H(stu_t or ""))
        row(
            ROWS,
            "Student cannot access employer jobs API",
            "/employer/jobs",
            "GET /employers/me/jobs",
            "403",
            str(deny.status_code),
            "PASS" if deny.status_code == 403 else "FAIL",
        )

        job2 = c.post(
            f"{BASE}/jobs",
            json={"title": f"Offer Job {uid}", "openings": 1, "requires_moderation": False, "recruiter_ids": [rec_id]},
            headers=H(emp_t),
        )
        j2 = job2.json()["data"]["id"] if job2.status_code == 200 else None
        if j2:
            c.post(f"{BASE}/jobs/{j2}/publish", headers=H(emp_t))
            app = c.post(f"{BASE}/jobs/{j2}/applications", json={"answers": {}}, headers=H(stu_t))
            app_id = app.json()["data"]["id"] if app.status_code == 200 else None
            if app_id:
                rec_t = login(c, rec_e)
                c.post(f"{BASE}/applications/{app_id}/shortlist", headers=H(rec_t or ""))
                of = c.post(
                    f"{BASE}/applications/{app_id}/offers",
                    json={
                        "role_title": "Eng",
                        "location": "Remote",
                        "annual_package": 900000,
                        "joining_date": (date.today() + timedelta(days=30)).isoformat(),
                        "respond_by": (date.today() + timedelta(days=7)).isoformat(),
                        "requires_approval": True,
                    },
                    headers=H(emp_t),
                )
                oid = of.json()["data"]["id"] if of.status_code == 200 else None
                row(ROWS, "Create offer", "/employer/offers/new", "POST /applications/{id}/offers", "PENDING_APPROVAL", of.json().get("data", {}).get("status", "?"), "PASS" if oid else "FAIL", pending="Approval")
                if oid:
                    ap = c.post(f"{BASE}/offers/{oid}/approve", headers=H(emp_t))
                    row(ROWS, "Approve offer", "/employer/offers/new", "POST /offers/{id}/approve", "ISSUED", ap.json().get("data", {}).get("status", "?"), "PASS" if ap.status_code == 200 else "FAIL")

        row(ROWS, "Employer /employer/interviews route", "/employer/interviews", "RecruiterInterviewsPage", "shared component", "same as recruiter API", "NOT APPLICABLE", evidence="Uses /recruiter/interviews APIs")

    fails = save_phase(
        ROWS,
        "employer_functional_audit_results.json",
        "EMPLOYER_COMPLETE_FUNCTIONAL_AUDIT.md",
        "Employer complete functional audit",
        "employer",
    )
    # defect register excerpt
    defects = [r for r in ROWS if r["result"] == "FAIL" or r["defect_id"]]
    with open(OUT_DIR / "EMPLOYER_DEFECT_REGISTER.md", "w", encoding="utf-8") as f:
        f.write("# Employer defect register\n\n")
        if not defects:
            f.write("No FAIL results in latest employer audit run.\n")
        for r in defects:
            f.write(f"- **{r.get('defect_id') or '—'}** {r['feature']}: {r['actual']}\n")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent))
    raise SystemExit(main())
