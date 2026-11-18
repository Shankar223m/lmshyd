#!/usr/bin/env python3
"""Quick API smoke across LMS roles after campus job reseed."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import httpx

API = "http://127.0.0.1:8000/api/v1"
JCMS = f"{API}/jcms"

ACCOUNTS = {
    "student": ("demo.student1@example.com", "Stud3nt!Lms#Demo1"),
    "employer": ("demo.employer1@example.com", "H1re!Demo#Emp1"),
    "recruiter": ("demo.recruiter1@example.com", "H1re!Demo#Rec1"),
    "institution": ("demo.head1@example.com", "H3ad!Inst#Demo1"),
    "admin": ("demo.superadmin1@example.com", "Sup3r!Admin#Demo1"),
}

CHECKS: list[tuple[str, str, str]] = [
    ("student", "GET", "/jobs/discover"),
    ("student", "GET", "/applications/me"),
    ("employer", "GET", "/employers/me/jobs"),
    ("employer", "GET", "/recruiter/applications"),
    ("recruiter", "GET", "/recruiter/applications"),
    ("institution", "GET", "/institutions/me/students"),
    ("institution", "GET", "/institutions/me/placements"),
    ("admin", "GET", "/admin/stats"),
    ("admin", "GET", "/jobs/discover"),
    ("admin", "GET", "/admin/jobs?tab=queue"),
    ("admin", "GET", "/admin/audit-logs?limit=5"),
]


def login(client: httpx.Client, email: str, password: str) -> str:
    r = client.post(f"{API}/auth/login", json={"identifier": email, "password": password})
    r.raise_for_status()
    return r.json()["token"]["access_token"]


def main() -> int:
    tokens: dict[str, str] = {}
    fails = 0
    with httpx.Client(timeout=45.0) as client:
        for role, (email, pw) in ACCOUNTS.items():
            try:
                tokens[role] = login(client, email, pw)
                print(f"OK login {role}")
            except Exception as exc:
                print(f"FAIL login {role}: {exc}")
                fails += 1

        for role, method, path in CHECKS:
            token = tokens.get(role)
            if not token:
                fails += 1
                continue
            r = client.request(method, f"{JCMS}{path}", headers={"Authorization": f"Bearer {token}"})
            ok = 200 <= r.status_code < 300
            extra = ""
            if ok and path.endswith("/discover"):
                jobs = r.json().get("data") or []
                extra = f" ({len(jobs)} jobs)"
            print(f"{'PASS' if ok else 'FAIL'} {role} {method} {path}{extra}")
            if not ok:
                fails += 1

    out = Path(__file__).resolve().parents[2] / "FUNCTIONAL_TESTING" / "jobs_role_smoke.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"failures": fails}, indent=2), encoding="utf-8")
    return 1 if fails else 0


if __name__ == "__main__":
    raise SystemExit(main())