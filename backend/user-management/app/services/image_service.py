"""Profile photos and organisation logos: small pictures kept in the database, checked by their real content."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.exceptions import ValidationFailedError
from app.models.stored_image import StoredImage

USER = "user"
ORGANIZATION = "organization"


def sniff_content_type(data: bytes) -> str | None:
    """PNG, JPEG or WebP by the file's own signature, never by the name or header the client claims."""
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


class ImageService:
    def __init__(self, db: AsyncSession, settings: Settings) -> None:
        self.db = db
        self.settings = settings

    def check(self, data: bytes) -> str:
        if not data:
            raise ValidationFailedError("Send the picture as the request body.", code="IMAGE_REQUIRED")
        if len(data) > self.settings.IMAGE_MAX_BYTES:
            raise ValidationFailedError(
                f"The picture is larger than {self.settings.IMAGE_MAX_BYTES // 1024} KB.", code="IMAGE_TOO_LARGE"
            )
        content_type = sniff_content_type(data)
        if content_type is None:
            raise ValidationFailedError("Use a PNG, JPEG or WebP picture.", code="IMAGE_TYPE_NOT_ALLOWED")
        return content_type

    async def get(self, kind: str, owner_public_id: int) -> StoredImage | None:
        stmt = select(StoredImage).where(StoredImage.owner_kind == kind, StoredImage.owner_public_id == owner_public_id)
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def put(self, kind: str, owner_public_id: int, data: bytes) -> None:
        content_type = self.check(data)
        image = await self.get(kind, owner_public_id)
        if image is None:
            self.db.add(StoredImage(owner_kind=kind, owner_public_id=owner_public_id, content_type=content_type, data=data))
        else:
            image.content_type, image.data = content_type, data

    async def delete(self, kind: str, owner_public_id: int) -> None:
        image = await self.get(kind, owner_public_id)
        if image is not None:
            await self.db.delete(image)
