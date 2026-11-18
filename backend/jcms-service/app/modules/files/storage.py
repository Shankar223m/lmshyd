import os
import uuid
from pathlib import Path

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.entities import StoredFile


class FileStorageService:
    def __init__(self) -> None:
        self.base = Path(settings.storage_local_path)
        self.base.mkdir(parents=True, exist_ok=True)

    def save_bytes(
        self,
        db: Session,
        *,
        owner_id: str,
        original_name: str,
        content_type: str,
        data: bytes,
        category: str,
    ) -> StoredFile:
        file_id = str(uuid.uuid4())
        ext = Path(original_name).suffix
        storage_key = f"{category}/{owner_id}/{file_id}{ext}"
        path = self.base / storage_key
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        record = StoredFile(
            id=file_id,
            owner_id=owner_id,
            original_name=original_name,
            content_type=content_type,
            size_bytes=len(data),
            storage_key=storage_key,
            category=category,
        )
        db.add(record)
        return record

    def read_bytes(self, record: StoredFile) -> bytes:
        path = self.base / record.storage_key
        if not path.exists():
            raise FileNotFoundError(record.storage_key)
        return path.read_bytes()


file_storage = FileStorageService()
