"""ai-gateway's internal API: one chat completion. Authenticated with the shared internal service token.

The gateway owns the provider keys, model routing, moderation and the organization's AI quota; this client only turns
its answers into outcomes the author can act on: it worked, it was blocked by moderation (``blocked``), or AI is not
available right now (``GatewayUnavailable``: quota used up, AI switched off, prompt not activated, provider down).
"""

from dataclasses import dataclass
from typing import Any

import httpx

from app.core.config import Settings


class GatewayUnavailable(Exception):
    def __init__(self, message: str, *, code: str | None = None) -> None:
        super().__init__(message)
        self.code = code


@dataclass(frozen=True, slots=True)
class Completion:
    status: str  # "ok" | "blocked"
    content: str


class GatewayClient:
    def __init__(self, settings: Settings, transport: httpx.AsyncBaseTransport | None = None) -> None:
        self.settings = settings
        self._transport = transport

    async def complete(
        self, *, organization_id: int, user_id: int, prompt_key: str, variables: dict[str, str], max_tokens: int, idempotency_key: str | None = None
    ) -> Completion:
        body: dict[str, Any] = {
            "organization_id": str(organization_id),
            "service": "assessment-service",
            "user_id": str(user_id),
            "prompt_key": prompt_key,
            "variables": variables,
            "messages": [{"role": "user", "content": "Write the questions now."}],
            "max_tokens": max_tokens,
            "stream": False,
        }
        headers = {"X-Internal-Service-Token": self.settings.INTERNAL_SERVICE_TOKEN.get_secret_value()}
        if idempotency_key:
            headers["Idempotency-Key"] = idempotency_key
        try:
            async with httpx.AsyncClient(
                base_url=self.settings.AI_GATEWAY_URL.rstrip("/"), timeout=self.settings.AI_GATEWAY_TIMEOUT_SECONDS, transport=self._transport
            ) as client:
                response = await client.post("/api/v1/internal/completions", json=body, headers=headers)
        except httpx.HTTPError as exc:
            raise GatewayUnavailable(f"ai-gateway unreachable: {exc.__class__.__name__}") from exc
        if response.status_code >= 400:
            code = None
            try:
                code = str(response.json().get("code"))
            except (ValueError, AttributeError):
                pass
            raise GatewayUnavailable(f"ai-gateway answered {response.status_code} {code or ''}".strip(), code=code)
        completion = response.json()["completion"]
        return Completion(status=completion["status"], content=completion.get("content", ""))
