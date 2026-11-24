import json
import logging
import os
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class VideoProbeInfo:
    width: int
    height: int
    duration_seconds: float
    fps: float
    video_codec: str
    has_audio: bool
    audio_codec: Optional[str]
    byte_size: int

    @property
    def resolution_str(self) -> str:
        if self.width and self.height:
            return f"{self.width}x{self.height}"
        return "unknown"


@dataclass
class OptimizationResult:
    final_path: str
    original_byte_size: int
    final_byte_size: int
    original_resolution: str
    output_resolution: str
    duration_seconds: int
    compression_method: str
    savings_percent: float
    is_optimized: bool


def _get_binary(name: str) -> str:
    """Find system ffmpeg or ffprobe, falling back to WinGet Gyan package and imageio_ffmpeg if available."""
    found = shutil.which(name)
    if found:
        return found
    # Check known WinGet Gyan package path
    winget_candidate = Path(os.environ.get("LOCALAPPDATA", "")) / "Microsoft" / "WinGet" / "Packages" / "Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe" / "ffmpeg-9.1-full_build" / "bin" / f"{name}.exe"
    if winget_candidate.exists():
        return str(winget_candidate)
    try:
        import imageio_ffmpeg
        if name == "ffmpeg":
            return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        pass
    return name


def probe_video(file_path: str | Path) -> Optional[VideoProbeInfo]:
    """Extract metadata using ffprobe."""
    ffprobe_bin = _get_binary("ffprobe")
    cmd = [
        ffprobe_bin,
        "-v", "error",
        "-show_entries", "stream=index,codec_type,codec_name,width,height,r_frame_rate,duration",
        "-show_entries", "format=duration,size",
        "-of", "json",
        str(file_path),
    ]

    try:
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
        data = json.loads(res.stdout)

        width = 0
        height = 0
        fps = 30.0
        video_codec = ""
        has_audio = False
        audio_codec = None
        duration = 0.0

        format_info = data.get("format", {})
        if "duration" in format_info:
            try:
                duration = float(format_info["duration"])
            except (ValueError, TypeError):
                pass

        byte_size = int(format_info.get("size", 0)) or os.path.getsize(file_path)

        for s in data.get("streams", []):
            codec_type = s.get("codec_type")
            if codec_type == "video" and not video_codec:
                video_codec = s.get("codec_name", "")
                width = int(s.get("width", 0))
                height = int(s.get("height", 0))
                # Compute fps
                r_fps = s.get("r_frame_rate", "30/1")
                if "/" in r_fps:
                    num, den = r_fps.split("/")
                    try:
                        fps = float(num) / float(den) if float(den) != 0 else 30.0
                    except (ValueError, ZeroDivisionError):
                        fps = 30.0
                if duration <= 0 and "duration" in s:
                    try:
                        duration = float(s["duration"])
                    except (ValueError, TypeError):
                        pass
            elif codec_type == "audio":
                has_audio = True
                audio_codec = s.get("codec_name")

        return VideoProbeInfo(
            width=width,
            height=height,
            duration_seconds=duration,
            fps=fps,
            video_codec=video_codec,
            has_audio=has_audio,
            audio_codec=audio_codec,
            byte_size=byte_size,
        )
    except Exception as e:
        logger.warning(f"ffprobe failed for {file_path}: {e}")
        return None


def optimize_video_file(
    input_path: str | Path,
    output_dir: Optional[str | Path] = None,
) -> OptimizationResult:
    """
    Automatic Video Compression & Optimization pipeline:
    1. Probes input video for resolution, framerate, duration, audio.
    2. Runs FFmpeg with visually lossless CRF 18, preset medium, faststart.
    3. Preserves original resolution (never downscale), aspect ratio, frame rate.
    4. Compares output size vs original size.
    5. Retains original if optimized file >= original or quality verification fails.
    """
    input_path = Path(input_path).resolve()
    orig_size = input_path.stat().st_size
    probe = probe_video(input_path)

    orig_res = probe.resolution_str if probe else "unknown"
    duration_sec = int(round(probe.duration_seconds)) if probe else 0

    if not probe or probe.width == 0 or probe.height == 0:
        logger.warning("Could not probe video streams. Retaining original.")
        return OptimizationResult(
            final_path=str(input_path),
            original_byte_size=orig_size,
            final_byte_size=orig_size,
            original_resolution=orig_res,
            output_resolution=orig_res,
            duration_seconds=duration_sec,
            compression_method="original_retained",
            savings_percent=0.0,
            is_optimized=False,
        )

    out_dir = Path(output_dir) if output_dir else input_path.parent
    out_dir.mkdir(parents=True, exist_ok=True)
    opt_path = out_dir / f"{input_path.stem}_optimized.mp4"

    ffmpeg_bin = _get_binary("ffmpeg")

    # Build FFmpeg command:
    # - CRF 18: visually lossless encoding (perceptual quality identical to master)
    # - preset medium: balanced compression efficiency and encode speed
    # - pix_fmt yuv420p: universal browser playback compatibility
    # - movflags +faststart: relocate moov atom to start for instant seeking and streaming
    # - No scaling: preserves exact width and height
    # - Frame rate preserved: r_frame_rate copied
    cmd = [
        ffmpeg_bin,
        "-y",
        "-i", str(input_path),
        "-c:v", "libx264",
        "-crf", "18",
        "-preset", "medium",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
    ]

    # Handle audio safely:
    if probe.has_audio:
        if probe.audio_codec == "aac":
            cmd.extend(["-c:a", "copy"])
        else:
            cmd.extend(["-c:a", "aac", "-b:a", "192k"])
    else:
        cmd.extend(["-an"])

    cmd.append(str(opt_path))

    try:
        logger.info(f"Starting video optimization for {input_path.name}...")
        proc = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=1800,  # 30 min maximum
        )

        if proc.returncode != 0:
            logger.warning(f"FFmpeg failed with code {proc.returncode}: {proc.stderr[:300]}")
            if opt_path.exists():
                opt_path.unlink()
            return OptimizationResult(
                final_path=str(input_path),
                original_byte_size=orig_size,
                final_byte_size=orig_size,
                original_resolution=orig_res,
                output_resolution=orig_res,
                duration_seconds=duration_sec,
                compression_method="original_retained",
                savings_percent=0.0,
                is_optimized=False,
            )

        # Quality & Size Verification
        opt_probe = probe_video(opt_path)
        opt_size = opt_path.stat().st_size

        # Verification checks:
        # 1. Output must exist and be valid
        # 2. Output resolution must match original
        # 3. Output size must be smaller than original
        duration_valid = True
        if opt_probe and probe.duration_seconds > 0:
            diff = abs(opt_probe.duration_seconds - probe.duration_seconds)
            if diff > 2.0:  # more than 2 seconds deviation
                duration_valid = False

        resolution_valid = (
            opt_probe is not None
            and opt_probe.width == probe.width
            and opt_probe.height == probe.height
        )

        if opt_size < orig_size and resolution_valid and duration_valid:
            savings = round((1.0 - (opt_size / orig_size)) * 100, 2)
            logger.info(
                f"Video successfully optimized! Original: {orig_size} bytes -> Optimized: {opt_size} bytes. "
                f"Saved {savings}%."
            )
            # Remove raw original file to save storage
            try:
                input_path.unlink()
            except Exception:
                pass

            return OptimizationResult(
                final_path=str(opt_path),
                original_byte_size=orig_size,
                final_byte_size=opt_size,
                original_resolution=orig_res,
                output_resolution=opt_probe.resolution_str,
                duration_seconds=int(round(opt_probe.duration_seconds)),
                compression_method="visually_lossless_crf18",
                savings_percent=savings,
                is_optimized=True,
            )
        else:
            # Original was already optimal or optimized file was larger
            logger.info(
                f"Optimized file was not smaller ({opt_size} >= {orig_size}) or failed verification. "
                f"Retaining original."
            )
            if opt_path.exists():
                opt_path.unlink()

            return OptimizationResult(
                final_path=str(input_path),
                original_byte_size=orig_size,
                final_byte_size=orig_size,
                original_resolution=orig_res,
                output_resolution=orig_res,
                duration_seconds=duration_sec,
                compression_method="original_retained",
                savings_percent=0.0,
                is_optimized=False,
            )

    except Exception as exc:
        logger.error(f"Error during video optimization: {exc}")
        if opt_path.exists():
            try:
                opt_path.unlink()
            except Exception:
                pass
        return OptimizationResult(
            final_path=str(input_path),
            original_byte_size=orig_size,
            final_byte_size=orig_size,
            original_resolution=orig_res,
            output_resolution=orig_res,
            duration_seconds=duration_sec,
            compression_method="original_retained",
            savings_percent=0.0,
            is_optimized=False,
        )
