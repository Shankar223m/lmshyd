"""Shared helpers for live functional audit scripts (jcms_test via HTTP API)."""

from __future__ import annotations

import json
from pathlib import Path

import httpx

BASE = "http://localhost:8000/api/v1"
OUT_DIR = Path(__file__).resolve().parents[2] / "FUNCTIONAL_TESTING"
PWD = "Test1234!"
SEED_ADMIN_EMAIL = "admin@jcms.local"
SEED_ADMIN_PWD = "Admin123!"


def verify_qa_db() -> tuple[bool, str]:
    try:
        with httpx.Client(timeout=10.0) as c:
            r = c.get(f"{BASE}/health")
            if r.status_code != 200:
                return False, f"health status {r.status_code}"
            db = r.json().get("database")
            return db == "healthy", f"database={db}"
    except Exception as e:
        return False, str(e)


def login(c: httpx.Client, email: str, password: str = PWD) -> str | None:
    r = c.post(f"{BASE}/auth/login", json={"email": email, "password": password})
    return r.json()["data"]["access_token"] if r.status_code == 200 else None


def admin_login(c: httpx.Client) -> str | None:
    """Platform admin from seed (avoids register rate limits)."""
    return login(c, SEED_ADMIN_EMAIL, SEED_ADMIN_PWD)


def flush_redis_rate_limits() -> bool:
    """Delete QA auth rate-limit keys only (no FLUSHALL)."""
    import subprocess

    try:
        # Keys match enforce_rate_limit patterns: auth:register:*, auth:login:*
        script = (
            "for _,p in ipairs({'auth:register:*','auth:login:*'}) do "
            "local k=redis.call('KEYS',p); for i=1,#k do redis.call('DEL',k[i]) end end; return 1"
        )
        subprocess.run(
            ["docker", "exec", "cursorjobs-redis-1", "redis-cli", "EVAL", script, "0"],
            check=True,
            capture_output=True,
            text=True,
            timeout=15,
        )
        return True
    except Exception:
        return False


def H(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def row(
    rows: list,
    feature: str,
    route: str,
    api: str,
    expected: str,
    actual: str,
    result: str,
    pending: str = "N/A",
    evidence: str = "",
    defect_id: str = "",
):
    rows.append(
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


def save_phase(rows: list, json_name: str, md_name: str, title: str, phase: str):
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    counts = {k: sum(1 for r in rows if r["result"] == k) for k in ("PASS", "FAIL", "NOT IMPLEMENTED", "NOT VERIFIED", "BLOCKED", "NOT APPLICABLE")}
    payload = {"phase": phase, "database": "jcms_test", "rows": rows, "counts": counts}
    with open(OUT_DIR / json_name, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
    with open(OUT_DIR / md_name, "w", encoding="utf-8") as f:
        f.write(f"# {title}\n\n**Database:** `jcms_test`  \n**Evidence:** `{json_name}`\n\n")
        f.write("| Feature | Route | API | Expected | Actual | Pending | Result | Defect |\n")
        f.write("|---------|-------|-----|----------|--------|---------|--------|--------|\n")
        for r in rows:
            f.write(
                f"| {r['feature']} | {r['route']} | {r['api']} | {r['expected']} | {r['actual']} | "
                f"{r['pending_state']} | **{r['result']}** | {r['defect_id']} |\n"
            )
        f.write("\n## Summary\n\n")
        for k, v in counts.items():
            if v:
                f.write(f"- {k}: {v}\n")
    return counts.get("FAIL", 0)
