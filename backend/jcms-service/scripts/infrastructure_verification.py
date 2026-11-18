#!/usr/bin/env python3
"""Infrastructure persistence verification (jcms_test API)."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import httpx
from audit_lib import BASE, H, OUT_DIR, PWD, login, verify_qa_db

ROWS = []


def main() -> int:
    if not verify_qa_db()[0]:
        return 2
    db_url = subprocess.check_output(["docker", "exec", "cursorjobs-api-1", "printenv", "DATABASE_URL"], text=True).strip()
    ROWS.append({"check": "DATABASE_URL is jcms_test", "result": "PASS" if "/jcms_test" in db_url else "FAIL", "detail": db_url[:80]})

    h = httpx.get(f"{BASE}/health", timeout=10)
    ROWS.append({"check": "API health", "result": "PASS" if h.status_code == 200 else "FAIL", "detail": h.json().get("database", "?")})

    for name, filt in [("postgres", "cursorjobs-postgres"), ("redis", "cursorjobs-redis"), ("worker", "cursorjobs-worker")]:
        try:
            st = subprocess.check_output(["docker", "ps", "--filter", f"name={filt}", "--format", "{{.Status}}"], text=True).strip()
            ROWS.append({"check": f"{name} container up", "result": "PASS" if "Up" in st else "FAIL", "detail": st})
        except Exception as e:
            ROWS.append({"check": f"{name} container up", "result": "BLOCKED", "detail": str(e)})

    marker = "infra_marker@example.com"
    with httpx.Client(timeout=30.0) as c:
        c.post(f"{BASE}/auth/register", json={"email": marker, "password": PWD, "full_name": "M", "role": "STUDENT"})
        t1 = login(c, marker)
        me1 = c.get(f"{BASE}/auth/me", headers=H(t1)).json()["data"]["email"]
        subprocess.run(["docker", "restart", "cursorjobs-api-1"], capture_output=True, timeout=120)
        import time

        for _ in range(30):
            time.sleep(2)
            try:
                if httpx.get(f"{BASE}/health", timeout=5).status_code == 200:
                    break
            except Exception:
                pass
        t2 = login(c, marker)
        me2 = c.get(f"{BASE}/auth/me", headers=H(t2)).json()["data"]["email"] if t2 else None
        ROWS.append({"check": "User persists after API restart", "result": "PASS" if me1 == me2 == marker else "FAIL", "detail": f"{me1}/{me2}"})
        ROWS.append({"check": "Session after restart", "result": "NOT VERIFIED", "detail": "New login required; refresh tokens not retested"})

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUT_DIR / "infrastructure_verification_results.json", "w", encoding="utf-8") as f:
        json.dump({"rows": ROWS}, f, indent=2)
    with open(OUT_DIR / "INFRASTRUCTURE_VERIFICATION_REPORT.md", "w", encoding="utf-8") as f:
        f.write("# Infrastructure verification\n\n")
        for r in ROWS:
            f.write(f"- **{r['result']}** {r['check']}: {r.get('detail','')}\n")
    return 1 if any(r["result"] == "FAIL" for r in ROWS) else 0


if __name__ == "__main__":
    raise SystemExit(main())
