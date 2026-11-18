from redis.asyncio import Redis

from app.core.config import Settings


def build_redis(settings: Settings) -> Redis:
    # The event consumer blocks on XREADGROUP for EVENTS_BLOCK_MS, so the socket timeout has to outlast
    # that wait: with a fixed 2s timeout every idle blocking read failed with "Timeout reading from
    # redis", which is what made the workers flap.
    block_timeout = getattr(settings, "EVENTS_BLOCK_MS", 5_000) / 1000
    return Redis.from_url(
        settings.REDIS_URL,
        decode_responses=True,
        socket_timeout=block_timeout + 5,
        socket_connect_timeout=2,
        health_check_interval=30,
    )
