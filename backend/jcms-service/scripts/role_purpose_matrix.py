"""Role-purpose matrix for JCMS under LMS JWT.

Accounts (demo):
  student        demo.student1@example.com / Stud3nt!Lms#Demo1
  employer       demo.employer1@example.com / Stud3nt!Lms#Demo1  (seeded)
  recruiter      demo.recruiter1@example.com / Stud3nt!Lms#Demo1 (seeded)
  institution    demo.head1@example.com / H3ad!Inst#Demo1
  staff->INST    demo.staff1@example.com / St4ff!Prof#Demo1
  platform admin demo.superadmin1@example.com / Sup3r!Admin#Demo1
"""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass, field

UM = "http://127.0.0.1:8001"
GW = "http://127.0.0.1:8000"
JCMS = "/api/v1/jcms"

ACCOUNTS = {
    "student": ("demo.student1@example.com", "Stud3nt!Lms#Demo1"),
    "employer": ("demo.employer1@example.com", "H1re!Demo#Emp1"),
    "recruiter": ("demo.recruiter1@example.com", "H1re!Demo#Rec1"),
    "institution": ("demo.head1@example.com", "H3ad!Inst#Demo1"),
    "staff": ("demo.staff1@example.com", "St4ff!Prof#Demo1"),
    "admin": ("demo.superadmin1@example.com", "Sup3r!Admin#Demo1"),
}


@dataclass
class Result:
    role: str
    purpose: str
    checks: list[tuple[str, bool, str]] = field(default_factory=list)

    def ok(self, name: str, detail: str = "") -> None:
        self.checks.append((name, True, detail))

    def fail(self, name: str, detail: str = "") -> None:
        self.checks.append((name, False, detail))

    @property
    def passed(self) -> int:
        return sum(1 for _, p, _ in self.checks if p)

    @property
    def total(self) -> int:
        return len(self.checks)


def call(method: str, url: str, token: str | None = None, data=None, form: bytes | None = None, mime: str | None = None):
    headers: dict[str, str] = {}
    body = None
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if form is not None:
        body = form
        if mime:
            headers["Content-Type"] = mime
    elif data is not None:
        body = json.dumps(data).encode()
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=40) as resp:
            raw = resp.read().decode(errors="replace")
            try:
                payload = json.loads(raw)
            except json.JSONDecodeError:
                payload = {"raw": raw[:200]}
            return resp.status, payload
    except urllib.error.HTTPError as e:
        raw = e.read().decode(errors="replace")
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            payload = {"raw": raw[:300]}
        return e.code, payload


def login(email: str, password: str) -> tuple[str, dict]:
    st, d = call("POST", f"{UM}/api/v1/auth/login", data={"identifier": email, "password": password})
    if st != 200 or not (d.get("token") or {}).get("access_token"):
        raise RuntimeError(f"login failed for {email}: {st} {d}")
    return d["token"]["access_token"], d.get("user") or {}


def j(path: str) -> str:
    return f"{GW}{JCMS}{path}"


def expect(res: Result, name: str, st: int, payload: dict, want_ok: bool, allow: set[int] | None = None) -> dict | None:
    allow = allow or set()
    ok_http = 200 <= st < 300
    if want_ok:
        if ok_http:
            res.ok(name, f"{st}")
            return payload.get("data") if isinstance(payload, dict) else payload
        res.fail(name, f"expected 2xx got {st}: {str(payload)[:180]}")
        return None
    # want denied
    if st in allow or st in {401, 403} or (
        isinstance(payload, dict)
        and (
            (payload.get("error") or {}).get("code") in {"FORBIDDEN", "LMS_AUTH_ONLY"}
            or payload.get("code") in {"FORBIDDEN", "NOT_AUTHENTICATED"}
        )
    ):
        res.ok(name, f"denied {st}")
        return None
    if not ok_http:
        res.ok(name, f"non-success {st}")
        return None
    res.fail(name, f"expected deny, got {st}: {str(payload)[:160]}")
    return None


def main() -> int:
    results: list[Result] = []
    tokens: dict[str, str] = {}
    users: dict[str, dict] = {}

    for key, (email, pw) in ACCOUNTS.items():
        tok, user = login(email, pw)
        tokens[key] = tok
        users[key] = user
        st, me = call("GET", j("/auth/me"), tok)
        mapped = (me.get("data") or {}).get("role") if st == 200 else "?"
        print(f"login {key:12} LMS={(user.get('role') or '?')} -> JCMS={mapped}")

    # ---------- STUDENT PURPOSE ----------
    r = Result("STUDENT", "Discover jobs, manage profile/resume, apply, track apps/interviews/offers/placement")
    t = tokens["student"]
    st, me = call("GET", j("/auth/me"), t)
    expect(r, "me is STUDENT", st, me, True)
    if st == 200 and (me.get("data") or {}).get("role") != "STUDENT":
        r.fail("role mapping", str((me.get("data") or {}).get("role")))
    else:
        r.ok("role mapping", "STUDENT")

    st, prof = call("GET", j("/auth/profile"), t)
    expect(r, "get profile", st, prof, True)
    st, patch = call(
        "PATCH",
        j("/auth/profile"),
        t,
        {
            "program": "B.Tech CSE",
            "graduation_year": 2026,
            "cgpa": 8.2,
            "skills": ["Python", "React"],
            "department": "CSE",
            "batch": "2022-26",
        },
    )
    expect(r, "update profile (placement readiness)", st, patch, True)

    pdf = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"
    boundary = "----bound"
    form = (
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"resume.pdf\"\r\n"
        f"Content-Type: application/pdf\r\n\r\n"
    ).encode() + pdf + f"\r\n--{boundary}--\r\n".encode()
    st, up = call(
        "POST",
        j("/files/upload?category=resumes"),
        token=t,
        form=form,
        mime=f"multipart/form-data; boundary={boundary}",
    )
    resume_id = None
    data = expect(r, "upload resume", st, up, True)
    if isinstance(data, dict):
        resume_id = data.get("id")
    if resume_id:
        st, _ = call("PATCH", j("/auth/profile"), t, {"resume_file_id": resume_id})
        expect(r, "attach resume to profile", st, _, True)

    st, disc = call("GET", j("/jobs/discover"), t)
    expect(r, "discover jobs", st, disc, True)
    st, apps = call("GET", j("/applications/me"), t)
    expect(r, "list my applications", st, apps, True)
    st, iv = call("GET", j("/interviews/me"), t)
    expect(r, "list my interviews", st, iv, True)
    st, off = call("GET", j("/offers/me"), t)
    expect(r, "list my offers", st, off, True)
    st, pl = call("GET", j("/placements/me"), t)
    expect(r, "list my placements", st, pl, True)

    # denials
    for path, label in [
        ("/employers/me/jobs", "cannot list employer jobs"),
        ("/recruiter/applications", "cannot screen"),
        ("/institutions/me/students", "cannot list institution students"),
        ("/admin/stats", "cannot view admin stats"),
        ("/admin/organizations/pending", "cannot verify orgs"),
    ]:
        st, payload = call("GET", j(path), t)
        expect(r, label, st, payload, False)
    st, payload = call("POST", j("/jobs"), t, {"title": "x", "description": "y"})
    expect(r, "cannot create job", st, payload, False)
    results.append(r)

    # ---------- EMPLOYER PURPOSE ----------
    r = Result("EMPLOYER", "Company profile, create/submit jobs, pipeline, offers, manage recruiters")
    t = tokens["employer"]
    st, me = call("GET", j("/auth/me"), t)
    expect(r, "me is EMPLOYER", st, me, True)
    role = (me.get("data") or {}).get("role")
    if role != "EMPLOYER":
        r.fail("role mapping", str(role))
    else:
        r.ok("role mapping", "EMPLOYER")

    st, org = call("GET", j("/employers/me"), t)
    expect(r, "get company profile", st, org, True)
    st, org_u = call("PATCH", j("/employers/me"), t, {"website": "https://brightpath.test", "industry": "IT"})
    expect(r, "update company profile", st, org_u, True)

    st, jobs = call("GET", j("/employers/me/jobs"), t)
    expect(r, "list my jobs", st, jobs, True)

    # assign recruiter if possible
    rec_jcms_id = None
    st, recs = call("GET", j("/employers/me/recruiters"), t)
    expect(r, "list recruiters", st, recs, True)
    # ensure recruiter exists in JCMS via their login (already done)
    st, rme = call("GET", j("/auth/me"), tokens["recruiter"])
    if st == 200:
        rec_jcms_id = (rme.get("data") or {}).get("id")

    job_body = {
        "title": "QA Software Engineer Intern",
        "description": "Build LMS hiring flows with Python and React.",
        "location": "Hyderabad",
        "employment_type": "INTERNSHIP",
        "work_mode": "HYBRID",
        "salary_min": 15000,
        "salary_max": 25000,
        "openings": 2,
        "skills": ["Python", "React"],
        "requires_moderation": True,
        "recruiter_ids": [rec_jcms_id] if rec_jcms_id else [],
        "eligibility": {
            "programs": ["B.Tech CSE", "B.Tech Computer Science"],
            "graduation_year_min": 2025,
            "graduation_year_max": 2027,
            "min_cgpa": 6.0,
            "required_skills": ["Python"],
            "max_backlogs": 2,
        },
        "questions": [{"text": "Why this role?", "required": True}],
    }
    st, created = call("POST", j("/jobs"), t, job_body)
    job = expect(r, "create job draft", st, created, True)
    job_id = job.get("id") if isinstance(job, dict) else None

    if job_id:
        st, sub = call("POST", j(f"/jobs/{job_id}/submit"), t, {})
        expect(r, "submit job for moderation", st, sub, True)
        st, pipe = call("GET", j(f"/jobs/{job_id}/pipeline"), t)
        expect(r, "view hiring pipeline", st, pipe, True)

    # denials
    st, payload = call("GET", j("/jobs/discover"), t)
    expect(r, "cannot discover as employer", st, payload, False)
    st, payload = call("GET", j("/admin/stats"), t)
    expect(r, "cannot use admin stats", st, payload, False)
    st, payload = call("GET", j("/institutions/me/students"), t)
    expect(r, "cannot list institution students", st, payload, False)
    results.append(r)

    # ---------- PLATFORM ADMIN PURPOSE ----------
    r = Result("PLATFORM_ADMINISTRATOR", "Verify orgs, moderate jobs, platform stats, audit")
    t = tokens["admin"]
    st, me = call("GET", j("/auth/me"), t)
    expect(r, "me is PLATFORM_ADMINISTRATOR", st, me, True)
    if (me.get("data") or {}).get("role") != "PLATFORM_ADMINISTRATOR":
        r.fail("role mapping", str((me.get("data") or {}).get("role")))
    else:
        r.ok("role mapping", "PLATFORM_ADMINISTRATOR")

    st, stats = call("GET", j("/admin/stats"), t)
    expect(r, "platform stats", st, stats, True)
    st, pending = call("GET", j("/admin/organizations/pending"), t)
    expect(r, "org verification queue", st, pending, True)
    st, orgs = call("GET", j("/admin/organizations"), t)
    expect(r, "list organizations", st, orgs, True)
    st, q = call("GET", j("/admin/jobs/pending-moderation"), t)
    expect(r, "job moderation queue", st, q, True)
    st, audit = call("GET", j("/admin/audit-logs"), t)
    expect(r, "audit logs", st, audit, True)

    if job_id:
        st, mod = call("POST", j(f"/admin/jobs/{job_id}/moderate"), t, {"action": "approve", "note": "Looks good"})
        expect(r, "approve/publish job", st, mod, True)

    st, payload = call("POST", j("/jobs"), t, {"title": "x", "description": "y"})
    expect(r, "admin cannot create employer job", st, payload, False)
    results.append(r)

    # ---------- STUDENT APPLY (after publish) ----------
    r = Result("STUDENT(apply)", "Apply to published job after admin approval")
    t = tokens["student"]
    st, disc = call("GET", j("/jobs/discover"), t)
    expect(r, "discover shows openings", st, disc, True)
    items = disc.get("data") if isinstance(disc.get("data"), list) else []
    if job_id and not any(i.get("id") == job_id for i in items):
        # still ok if eligibility filters; try direct get
        st, one = call("GET", j(f"/jobs/{job_id}"), t)
        expect(r, "open published job detail", st, one, True)
    elif items:
        r.ok("discover non-empty", f"{len(items)} jobs")
    else:
        r.fail("discover non-empty", "no published jobs visible")

    if job_id:
        st, app = call(
            "POST",
            j(f"/jobs/{job_id}/applications"),
            t,
            {"answers": {"Why this role?": "I want to learn hiring systems"}, "resume_file_id": resume_id},
        )
        expect(r, "apply to job", st, app, True)
        application_id = (app.get("data") or {}).get("id") if st < 300 else None
    else:
        application_id = None
        r.fail("apply to job", "no job_id")
    results.append(r)

    # ---------- RECRUITER PURPOSE ----------
    r = Result("RECRUITER", "Screen applications, schedule interviews, feedback")
    t = tokens["recruiter"]
    st, me = call("GET", j("/auth/me"), t)
    expect(r, "me is RECRUITER", st, me, True)
    if (me.get("data") or {}).get("role") != "RECRUITER":
        r.fail("role mapping", str((me.get("data") or {}).get("role")))
    else:
        r.ok("role mapping", "RECRUITER")

    st, scr = call("GET", j("/recruiter/applications"), t)
    expect(r, "screening inbox", st, scr, True)
    st, riv = call("GET", j("/recruiter/interviews"), t)
    expect(r, "recruiter interviews", st, riv, True)

    if application_id:
        st, screen = call("POST", j(f"/applications/{application_id}/screen"), t, {"note": "Strong fundamentals"})
        expect(r, "screen application", st, screen, True)
        st, short = call("POST", j(f"/applications/{application_id}/shortlist"), t, {})
        expect(r, "shortlist candidate", st, short, True)
        st, ivc = call(
            "POST",
            j(f"/applications/{application_id}/interviews"),
            t,
            {
                "round_name": "Technical Round 1",
                "format": "ONLINE",
                "starts_at": "2026-11-20T10:00:00+05:30",
                "ends_at": "2026-11-20T11:00:00+05:30",
                "meeting_link": "https://meet.example/jcms-qa",
            },
        )
        expect(r, "schedule interview", st, ivc, True)

    st, payload = call("POST", j("/jobs"), t, {"title": "x", "description": "y"})
    expect(r, "recruiter cannot create jobs", st, payload, False)
    st, payload = call("GET", j("/admin/stats"), t)
    expect(r, "recruiter cannot admin", st, payload, False)
    st, payload = call("GET", j("/jobs/discover"), t)
    expect(r, "recruiter cannot student discover", st, payload, False)
    results.append(r)

    # ---------- INSTITUTION PURPOSE ----------
    r = Result("INSTITUTION", "Students roster/import, placements verify, analytics, org profile")
    for key in ("institution", "staff"):
        t = tokens[key]
        st, me = call("GET", j("/auth/me"), t)
        role = (me.get("data") or {}).get("role")
        label = "HEAD" if key == "institution" else "STAFF"
        if role == "INSTITUTION":
            r.ok(f"{label} maps to INSTITUTION", role)
        else:
            r.fail(f"{label} maps to INSTITUTION", str(role))

    t = tokens["institution"]
    st, org = call("GET", j("/institutions/me"), t)
    expect(r, "institution profile", st, org, True)
    st, studs = call("GET", j("/institutions/me/students"), t)
    expect(r, "list students", st, studs, True)
    st, tmpl = call("GET", j("/institutions/me/students/csv-template"), t)
    expect(r, "student CSV template", st, tmpl, True)
    st, analytics = call("GET", j("/institutions/me/analytics"), t)
    expect(r, "placement analytics", st, analytics, True)
    st, places = call("GET", j("/institutions/me/placements"), t)
    expect(r, "institution placements", st, places, True)

    st, payload = call("POST", j("/jobs"), t, {"title": "x", "description": "y"})
    expect(r, "institution cannot create jobs", st, payload, False)
    st, payload = call("GET", j("/recruiter/applications"), t)
    expect(r, "institution cannot screen", st, payload, False)
    st, payload = call("GET", j("/admin/stats"), t)
    expect(r, "institution cannot admin", st, payload, False)
    results.append(r)

    # ---------- EMPLOYER pipeline after apply ----------
    r = Result("EMPLOYER(pipeline)", "Advance candidate / create offer after recruiter screening")
    t = tokens["employer"]
    if job_id:
        st, pipe = call("GET", j(f"/jobs/{job_id}/pipeline"), t)
        expect(r, "pipeline after applications", st, pipe, True)
    if application_id:
        st, note = call("POST", j(f"/applications/{application_id}/note"), t, {"note": "Employer reviewed"})
        expect(r, "add pipeline note", st, note, True)
        st, offer = call(
            "POST",
            j(f"/applications/{application_id}/offers"),
            t,
            {
                "role_title": "QA Software Engineer Intern",
                "location": "Hyderabad",
                "annual_package": 300000,
                "joining_date": "2026-12-01",
            },
        )
        expect(r, "create offer", st, offer, True)
    results.append(r)

    # Print report
    print("\n=== ROLE PURPOSE MATRIX ===")
    failed = 0
    for res in results:
        print(f"\n[{res.role}] purpose: {res.purpose}")
        print(f"  {res.passed}/{res.total} checks passed")
        for name, ok, detail in res.checks:
            mark = "PASS" if ok else "FAIL"
            if not ok:
                failed += 1
            print(f"  {mark}  {name}" + (f" — {detail}" if detail else ""))

    print(f"\nTOTAL FAILURES: {failed}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
