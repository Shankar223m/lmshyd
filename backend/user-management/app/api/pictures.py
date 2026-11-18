"""Shared bits of the profile-photo and logo endpoints."""

from fastapi import Request

from app.core.config import Settings
from app.core.exceptions import ValidationFailedError

PICTURE_HEADERS = {"Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff"}
PICTURE_BODY = {
    "requestBody": {
        "content": {kind: {"schema": {"type": "string", "format": "binary"}} for kind in ("image/png", "image/jpeg", "image/webp")}
    }
}


async def read_picture(request: Request, settings: Settings) -> bytes:
    """The request body, refusing early when it is too big to be a small picture."""
    limit = settings.IMAGE_MAX_BYTES
    too_big = ValidationFailedError(f"The picture is larger than {limit // 1024} KB.", code="IMAGE_TOO_LARGE")
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > limit:
        raise too_big
    chunks: list[bytes] = []
    size = 0
    async for chunk in request.stream():
        size += len(chunk)
        if size > limit:
            raise too_big
        chunks.append(chunk)
    return b"".join(chunks)
