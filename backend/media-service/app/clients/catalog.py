"""catalog-service's internal API: may this viewer play a lesson file (is it a lesson of a course they may open)?"""

import httpx

from app.core.config import Settings
from app.core.exceptions import ServiceUnavailableError


class CatalogClient:
    def __init__(self, settings: Settings, transport: httpx.AsyncBaseTransport | None = None) -> None:
        self.settings = settings
        self._transport = transport

    async def may_play(self, *, asset_id: int, user_id: int) -> bool:
        """Fails closed: when catalog-service cannot be asked, the answer is no and the caller gets a 503."""
        headers = {"X-Internal-Service-Token": self.settings.INTERNAL_SERVICE_TOKEN.get_secret_value()}
        try:
            async with httpx.AsyncClient(
                base_url=self.settings.CATALOG_SERVICE_URL.rstrip("/"),
                timeout=self.settings.CATALOG_SERVICE_TIMEOUT_SECONDS,
                transport=self._transport,
            ) as client:
                response = await client.get(f"/api/v1/internal/media/{asset_id}/access", params={"user_id": user_id}, headers=headers)
        except httpx.HTTPError as error:
            raise ServiceUnavailableError() from error
        if response.status_code != 200:
            raise ServiceUnavailableError()
        return bool(response.json().get("allowed"))
