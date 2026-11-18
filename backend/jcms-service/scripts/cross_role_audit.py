#!/usr/bin/env python3
"""Phase 6 cross-role — wraps qa_live_api; notification/outbox checks."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import httpx
from audit_lib import BASE, H, OUT_DIR, flush_redis_rate_limits, verify_qa_db

ROWS: list = []


def row(feature, api, expected, actual, result):
    ROWS.append({"feature": feature, "api": api, "expected": expected, "actual": actual, "result": result})
    print(f"[{result}] {feature}")


def main() -> int:
    if not verify_qa_db()[0]:
        return 2
    flush_redis_rate_limits()
    root = Path(__file__).resolve().parent
    proc = subprocess.run(
        [sys.executable, str(root / "qa_live_api.py"), str(OUT_DIR / "cross_role_e2e_results.json")],
        cwd=str(root.parent),
        capture_output=True,
        text=True,
        timeout=180,
    )
    row("Full cross-role lifecycle (qa_live_api)", "multi-step HTTP", "exit 0", str(proc.returncode), "PASS" if proc.returncode == 0 else "FAIL")

    # Outbox table presence on jcms_test (read-only count via docker)
    try:
        import subprocess as sp

        out = sp.check_output(
            ["docker", "exec", "cursorjobs-postgres-1", "psql", "-U", "jcms", "-d", "jcms_test", "-t", "-c", "SELECT COUNT(*) FROM outbox_events;"],
            text=True,
        ).strip()
        row("Outbox events table readable", "PostgreSQL jcms_test", "query ok", f"count={out}", "PASS")
    except Exception as e:
        row("Outbox events table readable", "PostgreSQL", "query ok", str(e), "BLOCKED")

    with httpx.Client(timeout=15.0) as c:
        h = c.get(f"{BASE}/health")
        row("API health after E2E", "GET /health", "healthy", h.json().get("database", "?"), "PASS" if h.status_code == 200 else "FAIL")

    payload = {"rows": ROWS, "qa_live_stdout": proc.stdout[-2000:] if proc.stdout else ""}
    with open(OUT_DIR / "cross_role_e2e_audit_results.json", "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
    with open(OUT_DIR / "CROSS_ROLE_END_TO_END_AUDIT.md", "w", encoding="utf-8") as f:
        f.write("# Cross-role end-to-end audit\n\n")
        f.write("Primary evidence: `cross_role_e2e_results.json` (38-step qa_live_api).\n\n")
        for r in ROWS:
            f.write(f"- **{r['result']}** {r['feature']}: {r['actual']}\n")
    return 1 if proc.returncode != 0 else 0


if __name__ == "__main__":
    raise SystemExit(main())
