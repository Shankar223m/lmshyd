from sqlalchemy import BigInteger, LargeBinary, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class StoredImage(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A small picture owned by a user (profile photo) or an organisation (logo).

    The browser downsizes it first, and the service accepts at most ``IMAGE_MAX_BYTES``, so rows stay a few tens of
    kilobytes. ``owner_public_id`` is the user's or organisation's public id; one image per owner.
    """

    __tablename__ = "stored_images"

    owner_kind: Mapped[str] = mapped_column(String(16))  # "user" | "organization"
    owner_public_id: Mapped[int] = mapped_column(BigInteger)
    content_type: Mapped[str] = mapped_column(String(32))
    data: Mapped[bytes] = mapped_column(LargeBinary)

    __table_args__ = (UniqueConstraint("owner_kind", "owner_public_id", name="uq_stored_images_owner"),)
