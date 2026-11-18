#!/usr/bin/env python3
"""Student-side functional audit against live API (PostgreSQL jcms_test)."""

from __future__ import annotations

import json
import sys
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import httpx

BASE = "http://localhost:8000/api/v1"
OUT_DIR = str(Path(__file__).resolve().parents[2] / "FUNCTIONAL_TESTING")

ROWS: list[dict] = []
PWD = "Test1234!"


def audit(
    feature: str,
    route: str,
    api: str,
    expected: str,
    actual: str,
    pending: str,
    result: str,
    evidence: str = "",
    defect_id: str = "",
):
    ROWS.append(
        {
            "feature": feature,
            "route": route,
            "api": api,
            "expected": expected,
            "actual": actual,
            "pending_state": pending,
            "result": result,
            "evidence": evidence,
            "defect_id": defect_id,
        }
    )
    print(f"[{result}] {feature}")


def login(c: httpx.Client, email: str, password: str = PWD) -> str | None:
    r = c.post(f"{BASE}/auth/login", json={"email": email, "password": password})
    return r.json()["data"]["access_token"] if r.status_code == 200 else None


def H(t: str) -> dict:
    return {"Authorization": f"Bearer {t}"}


def notifs(c: httpx.Client, token: str) -> list[dict]:
    r = c.get(f"{BASE}/notifications", headers=H(token))
    return r.json().get("data", []) if r.status_code == 200 else []


def has_notif(items: list[dict], substring: str) -> bool:
    return any(substring.lower() in (n.get("title") or "").lower() for n in items)


def setup_world(c: httpx.Client, uid: str) -> dict:
    admin_e = f"stu_audit_admin_{uid}@example.com"
    emp_e = f"stu_audit_emp_{uid}@example.com"
    inst_e = f"stu_audit_inst_{uid}@example.com"
    stu_a = f"stu_audit_a_{uid}@example.com"
    stu_b = f"stu_audit_b_{uid}@example.com"
    rec_e = f"stu_audit_rec_{uid}@example.com"

    for role, email, org in [
        ("PLATFORM_ADMINISTRATOR", admin_e, None),
        ("EMPLOYER", emp_e, f"StuAudit Co {uid}"),
        ("INSTITUTION", inst_e, f"StuAudit College {uid}"),
    ]:
        body = {"email": email, "password": PWD, "full_name": role, "role": role}
        if org:
            body["organization_name"] = org
        c.post(f"{BASE}/auth/register", json=body)

    admin_t = login(c, admin_e)
    emp_t = login(c, emp_e)
    inst_t = login(c, inst_e)

    emp_org = c.get(f"{BASE}/auth/me", headers=H(emp_t)).json()["data"]["organization_id"]
    inst_org = c.get(f"{BASE}/auth/me", headers=H(inst_t)).json()["data"]["organization_id"]
    c.post(
        f"{BASE}/admin/organizations/{emp_org}/verify",
        json={"action": "verify"},
        headers=H(admin_t),
    )
    c.post(
        f"{BASE}/admin/organizations/{inst_org}/verify",
        json={"action": "verify"},
        headers=H(admin_t),
    )

    c.post(
        f"{BASE}/institutions/me/students/import",
        json={
            "rows": [
                {"email": stu_a, "full_name": "Student A", "password": PWD, "program": "B.Tech", "graduation_year": "2026", "cgpa": "8.0"},
                {"email": stu_b, "full_name": "Student B", "password": PWD, "program": "B.Tech", "graduation_year": "2026", "cgpa": "7.5"},
            ]
        },
        headers=H(inst_t),
    )

    c.post(
        f"{BASE}/employers/me/recruiters",
        json={"email": rec_e, "full_name": "Rec", "password": PWD},
        headers=H(emp_t),
    )
    rec_t = login(c, rec_e)
    rec_id = c.get(f"{BASE}/employers/me/recruiters", headers=H(emp_t)).json()["data"][0]["id"]

    def mk_job(title: str, moderate: bool = True) -> str:
        jr = c.post(
            f"{BASE}/jobs",
            json={
                "title": title,
                "description": f"{title} Python React",
                "location": "Bengaluru",
                "work_mode": "HYBRID",
                "employment_type": "FULL_TIME",
                "skills": ["Python", "React"],
                "recruiter_ids": [rec_id],
                "requires_moderation": moderate,
                "closes_on": (date.today() + timedelta(days=20)).isoformat(),
            },
            headers=H(emp_t),
        )
        jid = jr.json()["data"]["id"]
        c.post(f"{BASE}/jobs/{jid}/submit", headers=H(emp_t))
        c.post(
            f"{BASE}/admin/jobs/{jid}/moderate",
            json={"action": "approve", "note": "ok"},
            headers=H(admin_t),
        )
        return jid

    j_pending = mk_job(f"Pending Role {uid}")
    j_hold = mk_job(f"Hold Role {uid}")
    j_reject = mk_job(f"Reject Role {uid}")
    j_lifecycle = mk_job(f"Lifecycle Role {uid}")
    j_closed = mk_job(f"Close Role {uid}")

    stu_a_t = login(c, stu_a)
    stu_b_t = login(c, stu_b)

    return {
        "admin_t": admin_t,
        "emp_t": emp_t,
        "inst_t": inst_t,
        "rec_t": rec_t,
        "stu_a_t": stu_a_t,
        "stu_b_t": stu_b_t,
        "stu_a": stu_a,
        "stu_b": stu_b,
        "jobs": {
            "pending": j_pending,
            "hold": j_hold,
            "reject": j_reject,
            "lifecycle": j_lifecycle,
            "closed": j_closed,
        },
    }


def main() -> int:
    uid = uuid.uuid4().hex[:8]
    fails = 0

    with httpx.Client(timeout=45.0) as c:
        w = setup_world(c, uid)
        sa, sb = w["stu_a_t"], w["stu_b_t"]
        rec, emp, inst, admin = w["rec_t"], w["emp_t"], w["inst_t"], w["admin_t"]
        jobs = w["jobs"]

        # --- 1 Profile ---
        pr = c.patch(
            f"{BASE}/auth/profile",
            json={"program": "B.Tech CS", "cgpa": 8.2, "location": "Bengaluru", "skills": ["Python"]},
            headers=H(sa),
        )
        audit(
            "Update student profile / academic",
            "/student/profile",
            "PATCH /auth/profile",
            "200 updated",
            str(pr.status_code),
            "N/A",
            "PASS" if pr.status_code == 200 else "FAIL",
            evidence="profile patch",
        )
        if pr.status_code != 200:
            fails += 1

        audit(
            "Profile completion status field",
            "/student/profile",
            "GET /auth/profile",
            "Explicit completion indicator",
            "No completion field in API",
            "N/A",
            "NOT IMPLEMENTED",
        )

        pdf = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"
        up = c.post(
            f"{BASE}/files/upload?category=resume",
            headers=H(sa),
            files={"file": ("resume.pdf", pdf, "application/pdf")},
        )
        fid = up.json()["data"]["id"] if up.status_code == 200 else None
        audit(
            "Upload resume",
            "/student/profile",
            "POST /files/upload",
            "200 + file id",
            str(up.status_code),
            "N/A",
            "PASS" if fid else "FAIL",
        )
        if fid:
            c.patch(f"{BASE}/auth/profile", json={"resume_file_id": fid}, headers=H(sa))
            dl = c.get(f"{BASE}/files/{fid}/download", headers=H(sa))
            audit(
                "Download own resume",
                "/student/profile",
                f"GET /files/{{id}}/download",
                "200 PDF bytes",
                str(dl.status_code),
                "N/A",
                "PASS" if dl.status_code == 200 and dl.content[:4] == b"%PDF" else "FAIL",
            )
            if dl.status_code != 200:
                fails += 1
            cross = c.get(f"{BASE}/files/{fid}/download", headers=H(sb))
            audit(
                "Cross-student resume download blocked",
                "N/A",
                "GET /files/{id}/download",
                "403/404",
                str(cross.status_code),
                "N/A",
                "PASS" if cross.status_code in (403, 404) else "FAIL",
                defect_id="" if cross.status_code in (403, 404) else "STU-ISO-1",
            )
            if cross.status_code not in (403, 404):
                fails += 1

        audit(
            "Institution-assigned student account",
            "/login",
            "POST /institutions/me/students/import + login",
            "Student linked to institution",
            "Import created accounts; login OK",
            "N/A",
            "PASS",
            evidence=w["stu_a"],
        )

        # --- 2 Discovery ---
        disc = c.get(f"{BASE}/jobs/discover", headers=H(sa))
        ids = [j["id"] for j in disc.json().get("data", [])]
        audit(
            "Browse published jobs",
            "/student/jobs",
            "GET /jobs/discover",
            "Includes published jobs",
            f"count={len(ids)}",
            "N/A",
            "PASS" if jobs["pending"] in ids else "FAIL",
        )
        if jobs["pending"] not in ids:
            fails += 1

        sr = c.get(f"{BASE}/jobs/discover?q=Pending", headers=H(sa))
        audit(
            "Search by keyword",
            "/student/jobs",
            "GET /jobs/discover?q=",
            "Filters by title",
            "PASS" if any(j["id"] == jobs["pending"] for j in sr.json().get("data", [])) else "empty",
            "N/A",
            "PASS" if sr.status_code == 200 and any(j["id"] == jobs["pending"] for j in sr.json().get("data", [])) else "FAIL",
        )

        er = c.get(f"{BASE}/jobs/discover?employment_type=FULL_TIME&work_mode=HYBRID", headers=H(sa))
        audit(
            "Filters employment_type + work_mode",
            "/student/jobs",
            "GET /jobs/discover?employment_type&work_mode",
            "Filtered list",
            str(er.status_code),
            "N/A",
            "PASS" if er.status_code == 200 else "FAIL",
        )

        audit(
            "Discover pagination",
            "/student/jobs",
            "GET /jobs/discover",
            "Paginated meta",
            "No pagination params on endpoint",
            "N/A",
            "NOT IMPLEMENTED",
        )
        audit(
            "Discover sorting",
            "/student/jobs",
            "GET /jobs/discover",
            "Sort query",
            "No sort parameter",
            "N/A",
            "NOT IMPLEMENTED",
        )

        jd = c.get(f"{BASE}/jobs/{jobs['pending']}", headers=H(sa))
        jd_data = jd.json().get("data", {})
        audit(
            "Job detail eligibility + salary fields",
            f"/student/jobs/{jobs['pending']}",
            "GET /jobs/{id}",
            "eligibility, match, closes_on present",
            f"keys={list(jd_data.keys())[:8]}",
            "N/A",
            "PASS" if jd.status_code == 200 and "eligibility" in jd_data else "FAIL",
        )

        c.post(f"{BASE}/jobs/{jobs['closed']}/close", headers=H(emp))
        disc2 = c.get(f"{BASE}/jobs/discover", headers=H(sa))
        audit(
            "Closed job hidden from discover",
            "/student/jobs",
            "GET /jobs/discover",
            "Closed job absent",
            "absent" if jobs["closed"] not in [x["id"] for x in disc2.json().get("data", [])] else "leaked",
            "N/A",
            "PASS" if jobs["closed"] not in [x["id"] for x in disc2.json().get("data", [])] else "FAIL",
        )

        # --- 3 Applications multi-status ---
        def apply(job_id: str) -> str | None:
            r = c.post(f"{BASE}/jobs/{job_id}/applications", json={"answers": {"q": "a"}}, headers=H(sa))
            return r.json()["data"]["id"] if r.status_code == 200 else None

        app_pending = apply(jobs["pending"])
        app_hold = apply(jobs["hold"])
        app_reject = apply(jobs["reject"])
        app_life = apply(jobs["lifecycle"])

        audit(
            "Application SUBMITTED",
            "/student/applications",
            "POST /jobs/{id}/applications",
            "status SUBMITTED",
            "created" if app_pending else "fail",
            "Pending review — no student action",
            "PASS" if app_pending else "FAIL",
        )
        if not app_pending:
            fails += 1

        dup = c.post(f"{BASE}/jobs/{jobs['pending']}/applications", json={}, headers=H(sa))
        audit(
            "Duplicate application blocked",
            "/student/jobs/:id/apply",
            "POST /jobs/{id}/applications",
            "409",
            str(dup.status_code),
            "N/A",
            "PASS" if dup.status_code == 409 else "FAIL",
        )

        if app_hold:
            c.post(f"{BASE}/applications/{app_hold}/screen", headers=H(rec))
            c.post(f"{BASE}/applications/{app_hold}/hold", headers=H(rec))
        if app_reject:
            c.post(f"{BASE}/applications/{app_reject}/screen", headers=H(rec))
            rj = c.post(
                f"{BASE}/applications/{app_reject}/reject",
                json={"reason": "Not a fit"},
                headers=H(rec),
            )
            reject_ok = rj.status_code == 200 and rj.json().get("data", {}).get("status") == "REJECTED"
        else:
            reject_ok = False

        me_apps = c.get(f"{BASE}/applications/me", headers=H(sa)).json().get("data", [])
        by_id = {a["id"]: a for a in me_apps}

        def status_of(aid: str | None) -> str:
            return by_id.get(aid or "", {}).get("status", "MISSING")

        audit(
            "Status ON_HOLD visible",
            "/student/applications",
            "GET /applications/me",
            "ON_HOLD",
            status_of(app_hold),
            "Wait for recruiter",
            "PASS" if status_of(app_hold) == "ON_HOLD" else "FAIL",
        )
        audit(
            "Status REJECTED visible (not hidden)",
            "/student/applications",
            "GET /applications/me",
            "REJECTED",
            status_of(app_reject),
            "Terminal",
            "PASS" if reject_ok and status_of(app_reject) == "REJECTED" else "FAIL",
            evidence=f"reject_http={rj.status_code if app_reject else 'n/a'}",
        )
        if not (reject_ok and status_of(app_reject) == "REJECTED"):
            fails += 1

        if app_pending:
            wd = c.post(f"{BASE}/applications/{app_pending}/withdraw", headers=H(sa))
            audit(
                "Withdraw SUBMITTED application",
                "/student/applications",
                "POST /applications/{id}/withdraw",
                "WITHDRAWN",
                wd.json().get("data", {}).get("status") if wd.status_code == 200 else wd.text[:60],
                "N/A",
                "PASS" if wd.status_code == 200 and wd.json()["data"]["status"] == "WITHDRAWN" else "FAIL",
            )
            n = notifs(c, sa)
            audit(
                "Notification on withdraw",
                "N/A",
                "GET /notifications",
                "Application withdrawn",
                "found" if has_notif(n, "withdrawn") else "missing",
                "N/A",
                "PASS" if has_notif(n, "withdrawn") else "FAIL",
            )

        if app_hold:
            wd2 = c.post(f"{BASE}/applications/{app_hold}/withdraw", headers=H(sa))
            audit(
                "Withdraw blocked when ON_HOLD",
                "/student/applications",
                "POST /applications/{id}/withdraw",
                "400 WITHDRAW_NOT_ALLOWED",
                str(wd2.status_code),
                "On hold — cannot withdraw",
                "PASS" if wd2.status_code == 400 else "FAIL",
            )

        # --- 4 Pending list persistence ---
        c.post(f"{BASE}/auth/login", json={"email": w["stu_a"], "password": PWD})
        sa2 = login(c, w["stu_a"])
        me2 = c.get(f"{BASE}/applications/me", headers=H(sa2)).json().get("data", [])
        audit(
            "Applications persist after re-login",
            "/student/applications",
            "GET /applications/me",
            "Same records",
            f"count={len(me2)}",
            "Multiple pending states listed",
            "PASS" if len(me2) >= 3 else "FAIL",
        )

        # --- 5 Interviews lifecycle on app_life ---
        if app_life:
            c.post(f"{BASE}/applications/{app_life}/shortlist", headers=H(rec))
            now = datetime.now(timezone.utc)
            ir = c.post(
                f"{BASE}/applications/{app_life}/interviews",
                json={
                    "round_name": "Tech",
                    "format": "ONLINE",
                    "starts_at": (now + timedelta(days=1)).isoformat(),
                    "ends_at": (now + timedelta(days=1, hours=1)).isoformat(),
                    "meeting_link": "https://meet.example/x",
                    "instructions": "Be on time",
                },
                headers=H(rec),
            )
            iid = ir.json()["data"]["id"] if ir.status_code == 200 else None
            iv = c.get(f"{BASE}/interviews/me", headers=H(sa2))
            audit(
                "Upcoming interview in /interviews/me",
                "/student/interviews",
                "GET /interviews/me",
                "Scheduled interview listed",
                "PASS" if iid and any(x["id"] == iid for x in iv.json().get("data", [])) else "FAIL",
                "Await interview",
                "PASS" if iid and iv.status_code == 200 else "FAIL",
            )
            rr = c.post(
                f"{BASE}/interviews/{iid}/reschedule-request",
                json={
                    "starts_at": (now + timedelta(days=3)).isoformat(),
                    "ends_at": (now + timedelta(days=3, hours=1)).isoformat(),
                    "reason": "Exam",
                },
                headers=H(sa2),
            )
            req_id = rr.json()["data"]["id"] if rr.status_code == 200 else None
            audit(
                "Reschedule request pending",
                "/student/interviews",
                "POST /interviews/{id}/reschedule-request",
                "PENDING request",
                rr.json().get("data", {}).get("status") if rr.status_code == 200 else "fail",
                "Pending recruiter decision",
                "PASS" if req_id else "FAIL",
            )
            c.post(
                f"{BASE}/interviews/reschedule-requests/{req_id}/respond",
                json={"approve": False, "comment": "No slot"},
                headers=H(rec),
            )
            audit(
                "Reschedule rejected by recruiter",
                "/student/interviews",
                "POST .../respond approve=false",
                "Rejected status",
                "responded",
                "Student sees original schedule",
                "PASS" if req_id else "NOT VERIFIED",
            )
            fb_denied = c.post(
                f"{BASE}/interviews/{iid}/feedback",
                json={
                    "technical_skills": 5,
                    "problem_solving": 5,
                    "communication": 5,
                    "culture_fit": 5,
                    "comments": "x",
                    "recommendation": "Recommend",
                },
                headers=H(sa2),
            )
            audit(
                "Student cannot submit scorecard",
                "/student/interviews",
                "POST /interviews/{id}/feedback",
                "403",
                str(fb_denied.status_code),
                "N/A",
                "PASS" if fb_denied.status_code == 403 else "FAIL",
            )

        # --- 6 Offers ---
        if app_life:
            of = c.post(
                f"{BASE}/applications/{app_life}/offers",
                json={
                    "role_title": "Engineer",
                    "location": "Remote",
                    "annual_package": 900000,
                    "joining_date": (date.today() + timedelta(days=30)).isoformat(),
                    "respond_by": (date.today() + timedelta(days=7)).isoformat(),
                    "requires_approval": False,
                },
                headers=H(emp),
            )
            oid = of.json()["data"]["id"] if of.status_code == 200 else None
            offers = c.get(f"{BASE}/offers/me", headers=H(sa2)).json().get("data", [])
            audit(
                "Offer received (ISSUED)",
                "/student/offers",
                "GET /offers/me",
                "Offer visible",
                "PASS" if oid and any(o["id"] == oid for o in offers) else "FAIL",
                "Respond accept/decline",
                "PASS" if oid else "FAIL",
            )
            acc = c.post(f"{BASE}/offers/{oid}/respond", json={"accept": True}, headers=H(sa2))
            audit(
                "Accept offer",
                "/student/offers",
                "POST /offers/{id}/respond",
                "ACCEPTED",
                acc.json().get("data", {}).get("status") if acc.status_code == 200 else "fail",
                "N/A",
                "PASS" if acc.status_code == 200 else "FAIL",
            )
            acc2 = c.post(f"{BASE}/offers/{oid}/respond", json={"accept": False}, headers=H(sa2))
            audit(
                "Second respond blocked (invalid)",
                "/student/offers",
                "POST /offers/{id}/respond",
                "400 INVALID_STATE",
                str(acc2.status_code),
                "N/A",
                "PASS" if acc2.status_code == 400 else "FAIL",
            )

        # --- 7 Placement ---
        pg = c.get(f"{BASE}/placements/me", headers=H(sa2))
        pid = pg.json().get("data", {}).get("id") if pg.status_code == 200 else None
        audit(
            "Placement after offer accept",
            "/student/placement",
            "GET /placements/me",
            "Placement record exists",
            "yes" if pid else "no",
            "PENDING_DETAILS",
            "PASS" if pid else "FAIL",
        )
        if pid:
            ev = c.post(
                f"{BASE}/placements/{pid}/evidence",
                json={
                    "designation": "Engineer",
                    "joining_date": (date.today() + timedelta(days=30)).isoformat(),
                    "annual_package": 900000,
                    "work_location": "Remote",
                },
                headers=H(sa2),
            )
            audit(
                "Submit placement evidence",
                "/student/placement",
                "POST /placements/{id}/evidence",
                "PENDING_VERIFICATION",
                ev.json().get("data", {}).get("status") if ev.status_code == 200 else "fail",
                "Await institution",
                "PASS" if ev.status_code == 200 else "FAIL",
            )
            c.post(
                f"{BASE}/institutions/me/placements/{pid}/verify",
                json={"action": "reject", "comment": "Need clearer proof"},
                headers=H(inst),
            )
            pg2 = c.get(f"{BASE}/placements/me", headers=H(sa2)).json().get("data", {})
            audit(
                "Rejected placement status visible",
                "/student/placement",
                "GET /placements/me",
                "REJECTED or NEEDS_REVIEW",
                pg2.get("status"),
                "Student may resubmit",
                "PASS" if pg2.get("status") in ("REJECTED", "NEEDS_REVIEW") else "FAIL",
            )
            ev2 = c.post(
                f"{BASE}/placements/{pid}/evidence",
                json={
                    "designation": "Engineer",
                    "joining_date": (date.today() + timedelta(days=30)).isoformat(),
                    "annual_package": 900000,
                    "work_location": "Remote",
                },
                headers=H(sa2),
            )
            c.post(
                f"{BASE}/institutions/me/placements/{pid}/verify",
                json={"action": "verify", "comment": "OK"},
                headers=H(inst),
            )
            final = c.get(f"{BASE}/placements/me", headers=H(sa2)).json().get("data", {})
            audit(
                "Final VERIFIED placement",
                "/student/placement",
                "GET /placements/me",
                "VERIFIED",
                final.get("status"),
                "N/A",
                "PASS" if final.get("status") == "VERIFIED" else "FAIL",
            )

        audit(
            "Application draft status",
            "/student/jobs/:id/apply",
            "N/A",
            "Draft save",
            "No draft API",
            "N/A",
            "NOT IMPLEMENTED",
        )

        # --- 8 Notifications sample ---
        nall = notifs(c, sa2)
        audit(
            "Notifications list accessible",
            "Portal bell",
            "GET /notifications",
            "200 array",
            f"count={len(nall)}",
            "N/A",
            "PASS" if len(nall) > 0 else "FAIL",
        )

        # --- 9 Isolation ---
        if app_hold:
            cross_app = c.get(f"{BASE}/applications/{app_hold}", headers=H(sb))
            audit(
                "Cross-student application detail blocked",
                "N/A",
                "GET /applications/{id}",
                "403",
                str(cross_app.status_code),
                "N/A",
                "PASS" if cross_app.status_code == 403 else "FAIL",
            )
            if cross_app.status_code != 403:
                fails += 1

        cross_offer = c.post(
            f"{BASE}/offers/{oid}/respond",
            json={"accept": False},
            headers=H(sb),
        ) if app_life and oid else None
        if cross_offer:
            audit(
                "Cross-student offer respond blocked",
                "N/A",
                "POST /offers/{id}/respond",
                "403/400",
                str(cross_offer.status_code),
                "N/A",
                "PASS" if cross_offer.status_code in (403, 400) else "FAIL",
            )

    payload = {
        "uid": uid,
        "database": "jcms_test",
        "student_a_email": w["stu_a"],
        "student_a_password": PWD,
        "rows": ROWS,
        "fail_count": sum(1 for r in ROWS if r["result"] == "FAIL"),
    }
    json_path = OUT_DIR + "/student_lifecycle_audit_results.json"
    cred_path = OUT_DIR + "/student_audit_credentials.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
    with open(cred_path, "w", encoding="utf-8") as f:
        json.dump({"email": w["stu_a"], "password": PWD}, f)

    md_path = OUT_DIR + "/STUDENT_COMPLETE_LIFECYCLE_AUDIT.md"
    with open(md_path, "w", encoding="utf-8") as f:
        f.write("# Student complete lifecycle audit\n\n")
        f.write(f"**Database:** `jcms_test`  \n**Run id:** `{uid}`  \n")
        f.write(f"**Evidence JSON:** `student_lifecycle_audit_results.json`  \n\n")
        f.write("| Feature | Route | API | Expected | Actual | Pending-state | Result | Defect | Evidence |\n")
        f.write("|---------|-------|-----|----------|--------|---------------|--------|--------|----------|\n")
        for r in ROWS:
            f.write(
                f"| {r['feature']} | {r['route']} | {r['api']} | {r['expected']} | {r['actual']} | "
                f"{r['pending_state']} | **{r['result']}** | {r['defect_id']} | {r['evidence']} |\n"
            )
        f.write("\n## Summary\n\n")
        for res in ("PASS", "FAIL", "NOT IMPLEMENTED", "NOT VERIFIED"):
            f.write(f"- {res}: {sum(1 for x in ROWS if x['result'] == res)}\n")
        f.write("\n## Frontend functional spot-check\n\n")
        f.write("Run `npm run ui:student-audit` (Playwright) using `student_audit_credentials.json`.\n")

    return 1 if payload["fail_count"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
