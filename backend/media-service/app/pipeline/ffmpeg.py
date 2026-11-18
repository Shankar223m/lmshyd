"""Thin async wrappers around the ``ffmpeg``/``ffprobe`` binaries. Both must be on PATH (the
runtime Docker image installs them; see Dockerfile). Every call is a real subprocess run with
``asyncio.create_subprocess_exec`` — no shell, no string-built commands, so a filename can never
inject an extra flag.

These two functions are the only things a test needs to monkeypatch to exercise the pipeline
without a real ffmpeg binary (see tests/unit/test_pipeline.py).
"""

import asyncio
import json
from dataclasses import dataclass


class TranscodeError(Exception):
    pass


@dataclass(frozen=True, slots=True)
class VideoInfo:
    duration_seconds: int
    height: int
    fps: float = 30.0


async def probe_video(local_path: str) -> VideoInfo:
    process = await asyncio.create_subprocess_exec(
        "ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams", local_path,
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await process.communicate()
    if process.returncode != 0:
        raise TranscodeError(f"ffprobe failed: {stderr.decode(errors='replace')[:500]}")

    data = json.loads(stdout)
    video_stream = next((s for s in data.get("streams", []) if s.get("codec_type") == "video"), None)
    if video_stream is None:
        raise TranscodeError("No video stream found")
    duration = float(data.get("format", {}).get("duration") or video_stream.get("duration") or 0)
    num, _, den = str(video_stream.get("avg_frame_rate") or "30/1").partition("/")
    try:
        fps = float(num) / float(den or 1)
    except (ValueError, ZeroDivisionError):
        fps = 30.0
    return VideoInfo(duration_seconds=round(duration), height=int(video_stream["height"]), fps=fps)


async def transcode_rendition(
    source_path: str,
    output_path: str,
    *,
    max_height: int,
    crf: int = 23,
    audio_bitrate: str = "128k",
    preset: str = "medium",
    max_fps: float | None = None,
    source_fps: float = 30.0,
    threads: int | None = None,
) -> None:
    """Re-encode to H.264/AAC, quality-targeted (CRF) rather than a fixed bitrate, scaled down to at most
    ``max_height`` (never upscaled). ``max_fps`` only ever lowers the frame rate (a 60 fps screen recording
    becomes 30 fps); ``threads`` keeps a long encode from taking the whole machine."""
    filters = f"scale=-2:'min({max_height},ih)'"
    if max_fps and source_fps > max_fps + 0.5:
        filters += f",fps={max_fps:g}"
    command = ["nice", "-n", "10", "ffmpeg", "-y", "-i", source_path, "-vf", filters]
    command += ["-c:v", "libx264", "-preset", preset, "-crf", str(crf), "-pix_fmt", "yuv420p"]
    if threads:
        command += ["-threads", str(threads)]
    command += ["-c:a", "aac", "-b:a", audio_bitrate, "-movflags", "+faststart", output_path]
    process = await asyncio.create_subprocess_exec(*command, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
    _, stderr = await process.communicate()
    if process.returncode != 0:
        raise TranscodeError(f"ffmpeg failed: {stderr.decode(errors='replace')[:500]}")
