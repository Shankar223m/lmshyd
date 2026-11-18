"""Outbound HTTP to sibling LMS services, forwarding the caller's bearer token."""

from __future__ import annotations

from typing import Any

import httpx

from app.core.config import Settings


class PeerClient:
    def __init__(self, settings: Settings, *, authorization: str | None) -> None:
        self.settings = settings
        self.authorization = authorization or ""

    def _headers(self, extra: dict[str, str] | None = None) -> dict[str, str]:
        headers = {"Authorization": self.authorization} if self.authorization else {}
        if extra:
            headers.update(extra)
        return headers

    async def get_json(self, base_url: str, path: str, *, timeout: float) -> tuple[int, Any]:
        async with httpx.AsyncClient(base_url=base_url.rstrip("/"), timeout=timeout) as client:
            response = await client.get(path, headers=self._headers())
            try:
                body = response.json()
            except Exception:
                body = {"raw": response.text}
            return response.status_code, body

    async def post_json(self, base_url: str, path: str, *, json: dict[str, Any] | None = None, timeout: float) -> tuple[int, Any]:
        async with httpx.AsyncClient(base_url=base_url.rstrip("/"), timeout=timeout) as client:
            response = await client.post(path, headers=self._headers({"Content-Type": "application/json"}), json=json or {})
            try:
                body = response.json()
            except Exception:
                body = {"raw": response.text}
            return response.status_code, body

    async def post_multipart(
        self, base_url: str, path: str, *, files: dict[str, Any], data: dict[str, Any] | None = None, timeout: float
    ) -> tuple[int, Any]:
        async with httpx.AsyncClient(base_url=base_url.rstrip("/"), timeout=timeout) as client:
            response = await client.post(path, headers=self._headers(), files=files, data=data or {})
            try:
                body = response.json()
            except Exception:
                body = {"raw": response.text}
            return response.status_code, body

    async def get_bytes(self, base_url: str, path: str, *, timeout: float) -> tuple[int, bytes, dict[str, str]]:
        async with httpx.AsyncClient(base_url=base_url.rstrip("/"), timeout=timeout, follow_redirects=True) as client:
            response = await client.get(path, headers=self._headers())
            headers = {k.lower(): v for k, v in response.headers.items()}
            return response.status_code, response.content, headers
