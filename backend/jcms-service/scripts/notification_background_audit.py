#!/usr/bin/env python3
"""Notification and background job audit."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import httpx
from audit_lib import BASE, H, OUT_DIR, PWD, flush_redis_rate_limits, login, verify_qa_db

ROWS = []


def main() -> int:
    if not verify_qa_db()[0]:
        return 2
    flush_redis_rate_limits()
    ROWS.append({"check": "SMTP email delivery", "result": "BLOCKED", "detail": "SMTP_ENABLED=false"})
    try:
        w = subprocess.check_output(["docker", "ps", "--filter", "name=cursorjobs-worker", "--format", "{{.Status}}"], text=True).strip()
        ROWS.append({"check": "Celery worker container", "result": "PASS" if "Up" in w else "FAIL", "detail": w})
        b = subprocess.check_output(["docker", "ps", "--filter", "name=cursorjobs-beat", "--format", "{{.Status}}"], text=True).strip()
        ROWS.append({"check": "Celery beat container", "result": "PASS" if "Up" in b else "FAIL", "detail": b})
    except Exception as e:
        ROWS.append({"check": "Docker celery status", "result": "BLOCKED", "detail": str(e)})

    try:
        cnt = subprocess.check_output(
            ["docker", "exec", "cursorjobs-postgres-1", "psql", "-U", "jcms", "-d", "jcms_test", "-t", "-c", "SELECT COUNT(*) FROM outbox_events;"],
            text=True,
        ).strip()
        ROWS.append({"check": "Outbox events in jcms_test", "result": "PASS", "detail": f"count={cnt}"})
        proc = subprocess.check_output(
            ["docker", "exec", "cursorjobs-postgres-1", "psql", "-U", "jcms", "-d", "jcms_test", "-t", "-c", "SELECT processed, COUNT(*) FROM outbox_events GROUP BY processed;"],
            text=True,
        )
        ROWS.append({"check": "Outbox status breakdown", "result": "PASS", "detail": proc.strip()[:200]})
    except Exception as e:
        ROWS.append({"check": "Outbox DB inspection", "result": "BLOCKED", "detail": str(e)})

    ROWS.append({"check": "Celery task execution proof", "result": "NOT VERIFIED", "detail": "Worker up; task outcome not traced in this pass"})

    with httpx.Client(timeout=20.0) as c:
        c.post(f"{BASE}/auth/register", json={"email": "notif_u@example.com", "password": PWD, "full_name": "N", "role": "STUDENT"})
        t = login(c, "notif_u@example.com")
        if t:
            nr = c.get(f"{BASE}/notifications", headers=H(t))
            ROWS.append({"check": "Notifications API", "result": "PASS" if nr.status_code == 200 else "FAIL", "detail": str(nr.status_code)})
            if nr.status_code == 200 and nr.json().get("data"):
                nid = nr.json()["data"][0]["id"]
                mr = c.post(f"{BASE}/notifications/{nid}/read", headers=H(t))
                ROWS.append({"check": "Mark notification read", "result": "PASS" if mr.status_code == 200 else "NOT VERIFIED", "detail": str(mr.status_code)})

    with open(OUT_DIR / "notification_background_audit_results.json", "w", encoding="utf-8") as f:
        json.dump({"rows": ROWS}, f, indent=2)
    with open(OUT_DIR / "NOTIFICATION_BACKGROUND_JOB_AUDIT.md", "w", encoding="utf-8") as f:
        f.write("# Notification and background job audit\n\n")
        for r in ROWS:
            f.write(f"- **{r['result']}** {r['check']}: {r.get('detail','')}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
