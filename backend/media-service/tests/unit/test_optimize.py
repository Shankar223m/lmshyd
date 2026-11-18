import random
from pathlib import Path

from PIL import Image

from app.pipeline.optimize import IMAGE_MAX_EDGE, optimize_image


def _noisy_jpeg(path: Path, size: tuple[int, int]) -> None:
    rng = random.Random(1)  # noqa: S311
    image = Image.new("RGB", size)
    image.putdata([(rng.randrange(256), rng.randrange(256), 128) for _ in range(size[0] * size[1])])
    image.save(path, "JPEG", quality=100)


def test_a_huge_photo_is_scaled_to_the_cap_and_shrinks(tmp_path: Path) -> None:
    src = tmp_path / "1_photo.jpg"
    _noisy_jpeg(src, (3200, 1800))
    before = src.stat().st_size
    kept = optimize_image(src)
    assert kept == src and kept.stat().st_size < before
    with Image.open(kept) as out:
        assert max(out.size) == IMAGE_MAX_EDGE
    assert not list(tmp_path.glob("1_*.tmp")) and not any((tmp_path / ".work").iterdir())


def test_a_file_that_is_not_an_image_is_left_alone(tmp_path: Path) -> None:
    src = tmp_path / "2_bad.jpg"
    src.write_bytes(b"not an image")
    assert optimize_image(src) == src and src.read_bytes() == b"not an image"


def test_s3_key_keeps_the_readable_filename() -> None:
    from app.domain.enums import AssetKind
    from app.services.media_optimizer import s3_key_for

    key = s3_key_for(AssetKind.VIDEO, 42, Path("/x/videos/42_00 - Course Structure.mp4"))
    assert key == "uploads/videos/42/00 - Course Structure.mp4"
