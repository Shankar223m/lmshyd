"""After a direct upload: compress it, move it to S3, and point the asset at the S3 object.

The author's upload is playable at once from local disk. Behind the scenes the file is shrunk (see app/pipeline/optimize),
uploaded to the bucket, and only then is the local copy deleted. If S3 is unreachable the local file is kept and the
next start-up tries again, so an upload is never lost.
"""

import asyncio
import logging
from pathlib import Path

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import Settings
from app.domain.enums import AssetKind, AssetStatus
from app.models.media_asset import MediaAsset
from app.models.rendition import Rendition
from app.pipeline import optimize
from app.storage import s3

logger = logging.getLogger("app.media.optimize")

LOCAL_PREFIX = "/api/v1/media/stream/"  # an asset still on local disk has this as its storage_key
_FOLDERS = {AssetKind.VIDEO: "videos", AssetKind.DOCUMENT: "documents", AssetKind.IMAGE: "images"}
_ONE_AT_A_TIME = asyncio.Semaphore(1)  # the server is small: one compression at a time, the rest wait their turn
_MP4 = ".mp4"


def _marker(path: Path, public_id: int) -> Path:
    """Records that an asset has been compressed (or judged not worth it), so it is never compressed twice."""
    return path.parent.parent / ".optimized" / str(public_id)


def s3_key_for(kind: AssetKind, public_id: int, path: Path) -> str:
    return f"uploads/{_FOLDERS[kind]}/{public_id}/{path.name.split('_', 1)[-1]}"


async def _compress(path: Path, public_id: int, kind: AssetKind) -> Path:
    marker = _marker(path, public_id)
    if kind == AssetKind.IMAGE or marker.exists():
        return path  # images were already shrunk during the upload itself
    try:
        async with _ONE_AT_A_TIME:
            return await (optimize.optimize_video(path) if kind == AssetKind.VIDEO else optimize.optimize_pdf(path))
    finally:
        marker.parent.mkdir(exist_ok=True)
        marker.touch()


async def process_stored_asset(
    sessionmaker: async_sessionmaker[AsyncSession], settings: Settings, *, public_id: int, path: Path, kind: AssetKind
) -> None:
    try:
        if not path.exists():  # noqa: ASYNC240
            return
        before = path.stat().st_size  # noqa: ASYNC240
        kept = await _compress(path, public_id, kind)
        size = kept.stat().st_size  # noqa: ASYNC240
        values: dict[str, object] = {"byte_size": size}
        if kept.suffix == _MP4:
            values["content_type"] = "video/mp4"

        storage_key = None
        if settings.DIRECT_UPLOADS_TO_S3:
            key = s3_key_for(kind, public_id, kept)
            content_type = str(values.get("content_type") or "") or None
            async with sessionmaker() as db:
                content_type = content_type or (await db.execute(select(MediaAsset.content_type).where(MediaAsset.public_id == public_id))).scalar_one_or_none()
            await s3.upload_file(settings, str(kept), key, content_type=content_type or "application/octet-stream")
            storage_key = key
            values["storage_key"] = key

        async with sessionmaker() as db:
            asset_id = (await db.execute(select(MediaAsset.id).where(MediaAsset.public_id == public_id))).scalar_one_or_none()
            if asset_id is None:
                return
            await db.execute(update(MediaAsset).where(MediaAsset.id == asset_id).values(**values))
            rendition_values: dict[str, object] = {"byte_size": size}
            if storage_key:
                rendition_values["storage_key"] = storage_key
            await db.execute(update(Rendition).where(Rendition.media_asset_id == asset_id).values(**rendition_values))
            await db.commit()
        if storage_key:
            kept.unlink(missing_ok=True)  # only after S3 has it and the database points at it
        logger.info("asset %s stored: %d -> %d bytes%s", public_id, before, size, " (S3)" if storage_key else " (local)")
    except Exception:  # noqa: BLE001 - the upload is still on local disk and still plays; the next start-up retries
        logger.exception("processing of asset %s failed", public_id)


async def resume_unfinished(sessionmaker: async_sessionmaker[AsyncSession], settings: Settings) -> None:
    """After a restart or a deploy: finish every upload that is still on local disk (compression and the move to S3)."""
    try:
        root = Path(settings.STORAGE_LOCAL_DIR)
        async with sessionmaker() as db:
            rows = (
                await db.execute(
                    select(MediaAsset.public_id, MediaAsset.kind).where(
                        MediaAsset.status == AssetStatus.READY,
                        MediaAsset.archived_at.is_(None),
                        MediaAsset.storage_key.like(f"{LOCAL_PREFIX}%"),
                    )
                )
            ).all()
        for public_id, kind in rows:
            found = next(iter((root / _FOLDERS[kind]).glob(f"{public_id}_*")), None)  # noqa: ASYNC240
            if found is not None:
                await process_stored_asset(sessionmaker, settings, public_id=public_id, path=found, kind=kind)
    except Exception:  # noqa: BLE001
        logger.exception("could not resume unfinished uploads")
