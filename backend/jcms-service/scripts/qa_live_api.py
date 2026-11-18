#!/usr/bin/env python3
"""Live API QA runner against Docker stack (PostgreSQL jcms_test). Does not reset databases."""

from __future__ import annotations

import json
import sys
import uuid
from datetime import date, datetime, timedelta, timezone

import httpx

BASE = "http://localhost:8000/api/v1"
RESULTS: list[dict] = []


def record(name: str, status: str, detail: str = "") -> bool:
    RESULTS.append({"name": name, "status": status, "detail": detail})
    print(f"[{status}] {name}" + (f" — {detail}" if detail else ""))
    return status != "PASS"


def login(client: httpx.Client, email: str, password: str) -> str | None:
    r = client.post(f"{BASE}/auth/login", json={"email": email, "password": password})
    if r.status_code != 200:
        return None
    return r.json()["data"]["access_token"]


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _write_results(failures: int):
    out_path = sys.argv[1] if len(sys.argv) > 1 else None
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "database": "jcms_test (via API container DATABASE_URL)",
        "results": RESULTS,
        "failures": failures,
        "passed": sum(1 for r in RESULTS if r["status"] == "PASS"),
        "failed": sum(1 for r in RESULTS if r["status"] == "FAIL"),
    }
    text = json.dumps(payload, indent=2)
    if out_path:
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(text)


def main() -> int:
    uid = uuid.uuid4().hex[:8]
    failures = 0

    with httpx.Client(timeout=45.0) as client:
        hr = client.get(f"{BASE}/health")
        if hr.status_code == 200 and hr.json().get("database") == "healthy":
            record("API health + DB", "PASS")
        else:
            failures += int(record("API health + DB", "FAIL", hr.text))

        # Auth: invalid login
        bad = client.post(f"{BASE}/auth/login", json={"email": "nope@x.com", "password": "bad"})
        failures += int(
            record(
                "Invalid credentials rejected",
                "PASS" if bad.status_code == 401 else "FAIL",
                str(bad.status_code),
            )
        )

        admin_email = "admin@jcms.local"
        admin_pwd = "Admin123!"
        emp_email = f"qa_emp_{uid}@example.com"
        stu_email = f"qa_stu_{uid}@example.com"
        rec_email = f"qa_rec_{uid}@example.com"
        inst_email = f"qa_inst_{uid}@example.com"
        pwd = "Test1234!"

        for role, email, org in [
            ("EMPLOYER", emp_email, f"QA Corp {uid}"),
            ("INSTITUTION", inst_email, f"QA College {uid}"),
        ]:
            body = {"email": email, "password": pwd, "full_name": f"QA {role}", "role": role}
            if org:
                body["organization_name"] = org
            rr = client.post(f"{BASE}/auth/register", json=body)
            if rr.status_code == 200:
                record(f"Register {role}", "PASS")
            else:
                failures += int(record(f"Register {role}", "FAIL", rr.text[:200]))

        admin_t = login(client, admin_email, admin_pwd)
        if admin_t:
            record("Login seed PLATFORM_ADMINISTRATOR", "PASS")
        else:
            failures += int(record("Login seed PLATFORM_ADMINISTRATOR", "FAIL", "admin@jcms.local missing — run seed against jcms_test"))
        emp_t = login(client, emp_email, pwd)
        inst_t = login(client, inst_email, pwd)
        if not all([admin_t, emp_t, inst_t]):
            record("Login QA users", "FAIL", "missing token")
            _write_results(failures + 1)
            return 1
        record("Login QA users", "PASS")

        # Refresh token
        login_r = client.post(f"{BASE}/auth/login", json={"email": admin_email, "password": admin_pwd})
        refresh = login_r.json()["data"]["refresh_token"]
        ref_r = client.post(f"{BASE}/auth/refresh", json={"refresh_token": refresh})
        failures += int(
            record(
                "Refresh token",
                "PASS" if ref_r.status_code == 200 and ref_r.json()["data"].get("access_token") else "FAIL",
                ref_r.text[:80],
            )
        )

        me = client.get(f"{BASE}/auth/me", headers=auth_headers(emp_t)).json()["data"]
        org_id = me["organization_id"]
        vr = client.post(
            f"{BASE}/admin/organizations/{org_id}/verify",
            json={"action": "verify", "comment": "QA verify"},
            headers=auth_headers(admin_t),
        )
        failures += int(record("Admin verify employer", "PASS" if vr.status_code == 200 else "FAIL", vr.text[:80]))

        inst_me = client.get(f"{BASE}/auth/me", headers=auth_headers(inst_t)).json()["data"]
        inst_org_id = inst_me["organization_id"]
        iv = client.post(
            f"{BASE}/admin/organizations/{inst_org_id}/verify",
            json={"action": "verify", "comment": "QA inst"},
            headers=auth_headers(admin_t),
        )
        failures += int(record("Admin verify institution", "PASS" if iv.status_code == 200 else "FAIL", iv.text[:80]))

        # Institution imports student (links institution_id on profile)
        imp = client.post(
            f"{BASE}/institutions/me/students/import",
            json={
                "rows": [
                    {
                        "email": stu_email,
                        "full_name": "QA Student",
                        "password": pwd,
                        "program": "B.Tech CS",
                        "graduation_year": "2026",
                        "cgpa": "8.5",
                    }
                ]
            },
            headers=auth_headers(inst_t),
        )
        failures += int(
            record(
                "Institution import student",
                "PASS" if imp.status_code == 200 and imp.json()["data"].get("created") == 1 else "FAIL",
                imp.text[:120],
            )
        )
        stu_t = login(client, stu_email, pwd)
        if not stu_t:
            failures += int(record("Student login after import", "FAIL"))
        else:
            record("Student login after import", "PASS")

        cr = client.post(
            f"{BASE}/employers/me/recruiters",
            json={"email": rec_email, "full_name": "QA Recruiter", "password": pwd},
            headers=auth_headers(emp_t),
        )
        rec_t = login(client, rec_email, pwd) if cr.status_code == 200 else None
        failures += int(record("Create recruiter", "PASS" if rec_t else "FAIL", cr.text[:80]))

        rec_ids = []
        if cr.status_code == 200:
            rec_ids = [client.get(f"{BASE}/employers/me/recruiters", headers=auth_headers(emp_t)).json()["data"][0]["id"]]

        jr = client.post(
            f"{BASE}/jobs",
            json={
                "title": f"QA Engineer {uid}",
                "description": "QA job",
                "location": "Remote",
                "skills": ["Python"],
                "requires_moderation": True,
                "recruiter_ids": rec_ids,
                "closes_on": (date.today() + timedelta(days=30)).isoformat(),
            },
            headers=auth_headers(emp_t),
        )
        job_id = jr.json()["data"]["id"] if jr.status_code == 200 else None
        failures += int(record("Create job", "PASS" if job_id else "FAIL", jr.text[:120]))

        app_id = None
        interview_id = None
        offer_id = None
        placement_id = None

        if job_id:
            client.post(f"{BASE}/jobs/{job_id}/submit", headers=auth_headers(emp_t))
            mr = client.post(
                f"{BASE}/admin/jobs/{job_id}/moderate",
                json={"action": "approve", "note": "QA"},
                headers=auth_headers(admin_t),
            )
            failures += int(record("Moderate approve job", "PASS" if mr.status_code == 200 else "FAIL", mr.text[:80]))

        if job_id and stu_t:
            discover = client.get(f"{BASE}/jobs/discover", headers=auth_headers(stu_t))
            in_discover = any(j["id"] == job_id for j in discover.json().get("data", []))
            failures += int(record("Student discover published job", "PASS" if in_discover else "FAIL"))

            app_r = client.post(
                f"{BASE}/jobs/{job_id}/applications",
                json={"answers": {"note": "QA apply"}},
                headers=auth_headers(stu_t),
            )
            app_id = app_r.json()["data"]["id"] if app_r.status_code == 200 else None
            failures += int(record("Student apply", "PASS" if app_id else "FAIL", app_r.text[:120]))

            dup = client.post(
                f"{BASE}/jobs/{job_id}/applications",
                json={"answers": {}},
                headers=auth_headers(stu_t),
            )
            failures += int(record("Duplicate apply blocked", "PASS" if dup.status_code == 409 else "FAIL", str(dup.status_code)))

        if app_id and rec_t:
            sl = client.post(f"{BASE}/applications/{app_id}/shortlist", headers=auth_headers(rec_t))
            failures += int(record("Recruiter shortlist", "PASS" if sl.status_code == 200 else "FAIL", sl.text[:80]))

            now = datetime.now(timezone.utc)
            ir = client.post(
                f"{BASE}/applications/{app_id}/interviews",
                json={
                    "round_name": "Technical",
                    "format": "ONLINE",
                    "starts_at": (now + timedelta(days=2)).isoformat(),
                    "ends_at": (now + timedelta(days=2, hours=1)).isoformat(),
                    "meeting_link": "https://meet.example.com/qa",
                    "instructions": "QA",
                },
                headers=auth_headers(rec_t),
            )
            interview_id = ir.json()["data"]["id"] if ir.status_code == 200 else None
            failures += int(record("Schedule interview", "PASS" if interview_id else "FAIL", ir.text[:80]))

        if interview_id and stu_t:
            stu_iv = client.get(f"{BASE}/interviews/me", headers=auth_headers(stu_t))
            failures += int(
                record(
                    "Student interviews/me",
                    "PASS" if any(i["id"] == interview_id for i in stu_iv.json().get("data", [])) else "FAIL",
                )
            )
            rr = client.post(
                f"{BASE}/interviews/{interview_id}/reschedule-request",
                json={
                    "starts_at": (now + timedelta(days=4)).isoformat(),
                    "ends_at": (now + timedelta(days=4, hours=1)).isoformat(),
                    "reason": "QA conflict",
                },
                headers=auth_headers(stu_t),
            )
            req_id = rr.json()["data"]["id"] if rr.status_code == 200 else None
            failures += int(record("Student reschedule request", "PASS" if req_id else "FAIL", rr.text[:80]))
            if req_id and rec_t:
                resp = client.post(
                    f"{BASE}/interviews/reschedule-requests/{req_id}/respond",
                    json={"approve": True, "comment": "OK"},
                    headers=auth_headers(rec_t),
                )
                failures += int(record("Recruiter approve reschedule", "PASS" if resp.status_code == 200 else "FAIL"))

        if interview_id and rec_t:
            fb = client.post(
                f"{BASE}/interviews/{interview_id}/feedback",
                json={
                    "technical_skills": 4,
                    "problem_solving": 4,
                    "communication": 4,
                    "culture_fit": 4,
                    "comments": "QA pass",
                    "recommendation": "Recommend",
                },
                headers=auth_headers(rec_t),
            )
            failures += int(record("Submit scorecard", "PASS" if fb.status_code == 200 else "FAIL", fb.text[:80]))

        if app_id and emp_t:
            of = client.post(
                f"{BASE}/applications/{app_id}/offers",
                json={
                    "role_title": "QA Engineer",
                    "location": "Remote",
                    "annual_package": 1000000,
                    "joining_date": (date.today() + timedelta(days=45)).isoformat(),
                    "respond_by": (date.today() + timedelta(days=14)).isoformat(),
                    "requires_approval": True,
                },
                headers=auth_headers(emp_t),
            )
            offer_id = of.json()["data"]["id"] if of.status_code == 200 else None
            failures += int(record("Create offer", "PASS" if offer_id else "FAIL", of.text[:80]))
            if offer_id:
                ap = client.post(f"{BASE}/offers/{offer_id}/approve", headers=auth_headers(emp_t))
                failures += int(record("Approve offer", "PASS" if ap.status_code == 200 else "FAIL", ap.text[:80]))

        if offer_id and stu_t:
            acc = client.post(
                f"{BASE}/offers/{offer_id}/respond",
                json={"accept": True},
                headers=auth_headers(stu_t),
            )
            failures += int(record("Student accept offer", "PASS" if acc.status_code == 200 else "FAIL", acc.text[:80]))
            pg = client.get(f"{BASE}/placements/me", headers=auth_headers(stu_t))
            if pg.status_code == 200 and pg.json().get("data"):
                placement_id = pg.json()["data"]["id"]
                record("Placement record after accept", "PASS")
            else:
                failures += int(record("Placement record after accept", "FAIL", pg.text[:80]))

        if placement_id and stu_t:
            ev = client.post(
                f"{BASE}/placements/{placement_id}/evidence",
                json={
                    "designation": "QA Engineer",
                    "joining_date": (date.today() + timedelta(days=45)).isoformat(),
                    "annual_package": 1000000,
                    "work_location": "Remote",
                },
                headers=auth_headers(stu_t),
            )
            failures += int(record("Submit placement evidence", "PASS" if ev.status_code == 200 else "FAIL", ev.text[:80]))

        if placement_id and inst_t:
            ip = client.get(f"{BASE}/institutions/me/placements", headers=auth_headers(inst_t))
            listed = ip.json().get("data", {}).get("placements", []) if ip.status_code == 200 else []
            has_p = any(p.get("id") == placement_id for p in (listed or []))
            failures += int(record("Institution placement queue", "PASS" if has_p else "FAIL"))
            vf = client.post(
                f"{BASE}/institutions/me/placements/{placement_id}/verify",
                json={"action": "verify", "comment": "QA verified"},
                headers=auth_headers(inst_t),
            )
            failures += int(record("Institution verify placement", "PASS" if vf.status_code == 200 else "FAIL", vf.text[:80]))
            if stu_t:
                final = client.get(f"{BASE}/placements/me", headers=auth_headers(stu_t))
                st = final.json().get("data", {}).get("status") if final.status_code == 200 else None
                failures += int(record("Final placement VERIFIED", "PASS" if st == "VERIFIED" else "FAIL", str(st)))

        # Recruiter isolation
        emp2_email = f"qa_emp2_{uid}@example.com"
        client.post(
            f"{BASE}/auth/register",
            json={
                "email": emp2_email,
                "password": pwd,
                "full_name": "Other Emp",
                "role": "EMPLOYER",
                "organization_name": f"Other {uid}",
            },
        )
        emp2_t = login(client, emp2_email, pwd)
        client.post(
            f"{BASE}/employers/me/recruiters",
            json={"email": f"qa_rec2_{uid}@example.com", "full_name": "Rec2", "password": pwd},
            headers=auth_headers(emp2_t),
        )
        rec2_t = login(client, f"qa_rec2_{uid}@example.com", pwd)
        if app_id and rec2_t:
            deny = client.get(f"{BASE}/recruiter/applications", headers=auth_headers(rec2_t))
            ids = [a["id"] for a in deny.json().get("data", [])]
            if app_id not in ids:
                record("Recruiter B cannot see A assignment", "PASS")
            else:
                failures += int(record("Recruiter B cannot see A assignment", "FAIL", "leaked"))

        pdf = client.get(f"{BASE}/institutions/me/analytics/export.pdf", headers=auth_headers(inst_t))
        if pdf.status_code == 200 and pdf.content[:4] == b"%PDF":
            record("Institution analytics PDF", "PASS")
        else:
            failures += int(record("Institution analytics PDF", "FAIL", str(pdf.status_code)))

        fake_file = str(uuid.uuid4())
        fr = client.get(f"{BASE}/files/{fake_file}/download", headers=auth_headers(stu_t or admin_t))
        failures += int(
            record(
                "Unknown file download denied",
                "PASS" if fr.status_code in (403, 404) else "FAIL",
                str(fr.status_code),
            )
        )
        fr_u = client.get(f"{BASE}/files/{fake_file}/download")
        failures += int(record("Unauthenticated file download", "PASS" if fr_u.status_code == 401 else "FAIL", str(fr_u.status_code)))

        nr = client.get(f"{BASE}/notifications", headers=auth_headers(stu_t or admin_t))
        failures += int(record("Notifications API", "PASS" if nr.status_code == 200 else "FAIL", str(nr.status_code)))

        ar = client.get(f"{BASE}/admin/audit-logs", headers=auth_headers(stu_t or admin_t))
        failures += int(record("Non-admin audit denied", "PASS" if ar.status_code == 403 else "FAIL", str(ar.status_code)))

        if admin_t:
            aa = client.get(f"{BASE}/admin/audit-logs?limit=5", headers=auth_headers(admin_t))
            failures += int(record("Admin audit logs", "PASS" if aa.status_code == 200 else "FAIL", str(aa.status_code)))

    _write_results(failures)
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
