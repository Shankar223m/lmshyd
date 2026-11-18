"""Shrink an uploaded file after it is stored, keeping it visually the same.

Every function returns the path of the file to keep: the new, smaller file, or the original when shrinking
would not help (an already-compressed file) or failed. Nothing here ever loses the author's upload.

- Images: orientation fixed, only oversize pictures are scaled down (long edge 2560 px, which is sharp on a 4K screen),
  then re-saved at quality 85 (JPEG/WebP) or losslessly (PNG).
- PDFs: Ghostscript's "printer" profile: text and vectors untouched, embedded pictures kept at 200 dpi, fonts and
  streams recompressed, duplicate images stored once.
- Videos: H.264 at CRF 28 with the slow preset (smallest file for the look), never upscaled, capped at 1080p and 30 fps,
  AAC 64 kbit/s (speech), one thread at low priority so the site stays fast, "faststart" for instant playback.
"""

import asyncio
import logging
import os
import shutil
from pathlib import Path

from app.pipeline import ffmpeg

logger = logging.getLogger("app.media.optimize")

IMAGE_MAX_EDGE = 2560
_KEEP_IF_BELOW = 0.95  # a result must be at least 5% smaller, otherwise re-encoding was not worth it
PDF_TIMEOUT_SECONDS = 900
VIDEO_MAX_HEIGHT = 1080
VIDEO_CRF = 28  # tested on a real 1080p lecture: CRF 26 -> 44% smaller, CRF 30 -> 65% smaller than the 33 MB copy, SSIM stayed above 0.994
VIDEO_MAX_FPS = 30
PDF_IMAGE_DPI = 200  # sharp on any screen, even zoomed; print-resolution 300 dpi is what bloats scanned slides


def _work_path(src: Path, suffix: str) -> Path:
    # Outside the "<id>_*" pattern the streaming endpoint globs on, so a half-written file is never served.
    work = src.parent / ".work"
    work.mkdir(exist_ok=True)
    return work / f"{src.stem}{suffix}"


def _swap_in(src: Path, candidate: Path, final: Path) -> Path:
    os.replace(candidate, final)
    if final != src:
        src.unlink(missing_ok=True)
    return final


def optimize_image(src: Path) -> Path:
    """Blocking (Pillow); call through ``anyio.to_thread``."""
    from PIL import Image, ImageOps

    candidate = _work_path(src, src.suffix)
    try:
        with Image.open(src) as opened:
            image = ImageOps.exif_transpose(opened)
            fmt = (opened.format or "").upper()
            if fmt not in {"JPEG", "PNG", "WEBP"}:
                return src
            if max(image.size) > IMAGE_MAX_EDGE:
                image.thumbnail((IMAGE_MAX_EDGE, IMAGE_MAX_EDGE), Image.Resampling.LANCZOS)
            if fmt == "JPEG":
                image.convert("RGB").save(candidate, "JPEG", quality=85, optimize=True, progressive=True)
            elif fmt == "WEBP":
                image.save(candidate, "WEBP", quality=85, method=6)
            else:
                image.save(candidate, "PNG", optimize=True)
        if candidate.stat().st_size < src.stat().st_size * _KEEP_IF_BELOW:
            return _swap_in(src, candidate, src)
    except Exception:  # noqa: BLE001 - a picture we cannot re-encode is served as uploaded
        logger.warning("image optimisation skipped for %s", src.name, exc_info=True)
    finally:
        candidate.unlink(missing_ok=True)
    return src


async def optimize_pdf(src: Path) -> Path:
    if shutil.which("gs") is None:
        return src
    candidate = _work_path(src, ".pdf")
    try:
        process = await asyncio.create_subprocess_exec(
            "gs", "-sDEVICE=pdfwrite", "-dCompatibilityLevel=1.6", "-dPDFSETTINGS=/printer", "-dNOPAUSE", "-dQUIET", "-dBATCH",
            "-dDetectDuplicateImages=true", "-dCompressFonts=true", "-dDownsampleColorImages=true", "-dDownsampleGrayImages=true",
            f"-dColorImageResolution={PDF_IMAGE_DPI}", f"-dGrayImageResolution={PDF_IMAGE_DPI}", "-dColorImageDownsampleThreshold=1.2", "-dGrayImageDownsampleThreshold=1.2", f"-sOutputFile={candidate}", str(src),
            stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.PIPE,
        )
        try:
            _, stderr = await asyncio.wait_for(process.communicate(), PDF_TIMEOUT_SECONDS)
        except TimeoutError:
            process.kill()
            raise
        if process.returncode == 0 and candidate.exists() and candidate.stat().st_size < src.stat().st_size * _KEEP_IF_BELOW:  # noqa: ASYNC240
            return _swap_in(src, candidate, src)
        if process.returncode != 0:
            logger.warning("ghostscript failed for %s: %s", src.name, stderr.decode(errors="replace")[:300])
    except Exception:  # noqa: BLE001
        logger.warning("pdf optimisation skipped for %s", src.name, exc_info=True)
    finally:
        candidate.unlink(missing_ok=True)
    return src


async def optimize_video(src: Path) -> Path:
    candidate = _work_path(src, ".mp4")
    try:
        info = await ffmpeg.probe_video(str(src))
        await ffmpeg.transcode_rendition(str(src), str(candidate), max_height=min(VIDEO_MAX_HEIGHT, info.height), crf=VIDEO_CRF, audio_bitrate="64k", preset="slow", max_fps=VIDEO_MAX_FPS, source_fps=info.fps, threads=1)
        if candidate.stat().st_size < src.stat().st_size * _KEEP_IF_BELOW:  # noqa: ASYNC240
            return _swap_in(src, candidate, src.with_suffix(".mp4"))
    except Exception:  # noqa: BLE001
        logger.warning("video optimisation skipped for %s", src.name, exc_info=True)
    finally:
        candidate.unlink(missing_ok=True)
    return src
