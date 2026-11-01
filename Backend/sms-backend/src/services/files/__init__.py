"""Uploaded files: a `files` row per upload, the bytes in the configured FileStorage."""
import hashlib
from uuid import UUID, uuid4

from sqlalchemy.orm import Session

from src.db.models.resources.file import StoredFile
from src.services.files.storage import FileStorage, FileStorageError, get_storage, set_storage

__all__ = ["store_file", "read_file", "storage_key", "FileStorage", "FileStorageError",
           "get_storage", "set_storage"]


def storage_key(tenant_id, file_id) -> str:
    return f"{tenant_id}/{file_id}"


def store_file(db: Session, tenant_id: UUID, data: bytes, *, filename: str, content_type: str,
               uploaded_by=None) -> StoredFile:
    """Write the bytes to storage and add (flush) their row. The bytes are written first: if the
    request later rolls back, an unreferenced object is left in storage, never a row without bytes."""
    file_id = uuid4()
    key = storage_key(tenant_id, file_id)
    get_storage().put(key, data, content_type)
    row = StoredFile(id=file_id, tenant_id=tenant_id, storage_key=key, filename=filename, content_type=content_type,
                     size_bytes=len(data), sha256=hashlib.sha256(data).hexdigest(), uploaded_by=uploaded_by)
    db.add(row)
    db.flush()
    return row


def read_file(row: StoredFile) -> bytes:
    return get_storage().get(row.storage_key)

