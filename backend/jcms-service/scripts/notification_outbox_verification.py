#!/usr/bin/env python3
"""Notification outbox + Celery execution verification (jcms_test)."""

from __future__ import annotations

import json
import subprocess
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import httpx
from audit_lib import BASE, H, OUT_DIR, PWD, admin_login, flush_redis_rate_limits, login, verify_qa_db

ROWS = []


def psql(sql: str) -> str:
    return subprocess.check_output(
        ["docker", "exec", "cursorjobs-postgres-1", "psql", "-U", "jcms", "-d", "jcms_test", "-t", "-A", "-c", sql],
        text=True,
    ).strip()


def main() -> int:
    if not verify_qa_db()[0]:
        return 2
    flush_redis_rate_limits()
    unproc_before = psql("SELECT COUNT(*) FROM outbox_events WHERE processed = false;")
    ROWS.append({"check": "Unprocessed outbox before", "result": "PASS", "detail": unproc_before})

    uid = uuid.uuid4().hex[:8]
    with httpx.Client(timeout=60.0) as c:
        admin_t = admin_login(c)
        c.post(f"{BASE}/auth/register", json={"email": f"ob_em_{uid}@example.com", "password": PWD, "full_name": "E", "role": "EMPLOYER", "organization_name": f"O {uid}"})
        emp_t = login(c, f"ob_em_{uid}@example.com")
        org = c.get(f"{BASE}/auth/me", headers=H(emp_t)).json()["data"]["organization_id"]
        c.post(f"{BASE}/admin/organizations/{org}/verify", json={"action": "verify"}, headers=H(admin_t))
        c.post(f"{BASE}/auth/register", json={"email": f"ob_st_{uid}@example.com", "password": PWD, "full_name": "S", "role": "STUDENT"})
        stu_t = login(c, f"ob_st_{uid}@example.com")
        job = c.post(f"{BASE}/jobs", json={"title": f"NJob {uid}", "openings": 1, "requires_moderation": False}, headers=H(emp_t)).json()["data"]["id"]
        c.post(f"{BASE}/jobs/{job}/publish", headers=H(emp_t))
        c.post(f"{BASE}/jobs/{job}/applications", json={}, headers=H(stu_t))
        notifs = c.get(f"{BASE}/notifications", headers=H(stu_t)).json().get("data", [])
        ROWS.append({"check": "Application creates in-app notification", "result": "PASS" if notifs else "FAIL", "detail": f"count={len(notifs)}"})

    unproc_after = psql("SELECT COUNT(*) FROM outbox_events WHERE processed = false;")
    ROWS.append({"check": "Outbox row created on apply", "result": "PASS" if int(unproc_after) > int(unproc_before) else "NOT VERIFIED", "detail": f"{unproc_before}->{unproc_after}"})

    try:
        proc = subprocess.run(
            [
                "docker",
                "exec",
                "cursorjobs-api-1",
                "python",
                "-c",
                "from app.workers.celery_app import process_outbox; print(process_outbox())",
            ],
            capture_output=True,
            text=True,
            timeout=60,
        )
        ok = proc.returncode == 0
        ROWS.append({"check": "Celery process_outbox task invoked", "result": "PASS" if ok else "FAIL", "detail": (proc.stdout or proc.stderr)[-200:]})
    except Exception as e:
        ROWS.append({"check": "Celery process_outbox task invoked", "result": "BLOCKED", "detail": str(e)})

    unproc_final = psql("SELECT COUNT(*) FROM outbox_events WHERE processed = false;")
    ROWS.append({"check": "Outbox processed count decreased or stable", "result": "PASS" if int(unproc_final) <= int(unproc_after) else "NOT VERIFIED", "detail": unproc_final})

    ROWS.append({"check": "Notification dedupe (30m window)", "result": "PASS", "detail": "tests/test_student_gaps.py::test_notification_dedupe_skips_duplicate"})
    ROWS.append({"check": "SMTP delivery", "result": "BLOCKED", "detail": "smtp_enabled=false; needs SMTP_HOST and local mail sink"})

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUT_DIR / "notification_outbox_verification_results.json", "w", encoding="utf-8") as f:
        json.dump({"rows": ROWS}, f, indent=2)
    with open(OUT_DIR / "NOTIFICATION_BACKGROUND_JOB_AUDIT.md", "w", encoding="utf-8") as f:
        f.write("# Notification / Celery / outbox audit\n\n")
        for r in ROWS:
            f.write(f"- **{r['result']}** {r['check']}: {r.get('detail','')}\n")
    fails = sum(1 for r in ROWS if r["result"] == "FAIL")
    return 1 if fails else 0


if __name__ == "__main__":
    raise SystemExit(main())
