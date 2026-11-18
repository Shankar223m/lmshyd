"""Redis-backed rate limiting with in-memory fallback for dev/tests."""

import time
from threading import Lock

from app.core.config import settings
from app.core.exceptions import AppError

_memory: dict[str, list[float]] = {}
_memory_lock = Lock()


def _redis_client():
    try:
        import redis

        client = redis.from_url(settings.redis_url, socket_connect_timeout=0.3)
        client.ping()
        return client
    except Exception:
        return None


def enforce_rate_limit(key: str, *, limit: int, window_seconds: int) -> None:
    """Raise AppError 429 if key exceeds limit within window."""
    if settings.app_env in ("test", "testing"):
        return
    client = _redis_client()
    if client:
        count = client.incr(key)
        if count == 1:
            client.expire(key, window_seconds)
        if int(count) > limit:
            raise AppError("RATE_LIMITED", "Too many requests. Please try again later.", 429)
        return

    now = time.time()
    with _memory_lock:
        hits = [t for t in _memory.get(key, []) if now - t < window_seconds]
        if len(hits) >= limit:
            raise AppError("RATE_LIMITED", "Too many requests. Please try again later.", 429)
        hits.append(now)
        _memory[key] = hits


def client_ip(request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host or "unknown"
    return "unknown"
