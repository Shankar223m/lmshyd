"""Rate limit smoke test against live API (requires APP_ENV != test on server)."""

import httpx

BASE = "http://localhost:8000/api/v1"


def test_login_rate_limit_eventually_429():
    """After many failed logins, expect 429 (limit 20/min/IP)."""
    statuses = []
    with httpx.Client(timeout=10.0) as client:
        for _ in range(25):
            r = client.post(
                f"{BASE}/auth/login",
                json={"email": "nonexistent@example.com", "password": "wrong"},
            )
            statuses.append(r.status_code)
    assert 429 in statuses, f"expected rate limit 429, got {set(statuses)}"
    assert all(s in (401, 429) for s in statuses), f"unexpected statuses {set(statuses)}"
