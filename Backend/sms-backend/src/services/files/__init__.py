"""Uploaded files: a `files` row per upload, the bytes in the configured FileStorage."""
import hashlib
import logging
from datetime import datetime, timedelta, UTC
from typing import Tuple
from uuid import UUID, uuid4

from sqlalchemy.orm import Session

from src.db.models.academics.daily_attendance import AttendanceDocument
from src.db.models.resources.file import StoredFile
from src.services.files.storage import FileStorage, FileStorageError, get_storage, set_storage

__all__ = ["store_file", "read_file", "storage_key", "cleanup_unreferenced", "FileStorage", "FileStorageError",
           "get_storage", "set_storage"]

logger = logging.getLogger(__name__)

# Nothing younger than this is removed: an upload whose request is still running isn't referenced yet
CLEANUP_GRACE = timedelta(days=1)


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


def cleanup_unreferenced(db: Session, *, now: datetime = None) -> Tuple[int, int]:
    """Remove what nothing refers to any more, older than CLEANUP_GRACE (every school; needs a
    platform session). Returns (file rows removed, stray storage objects removed):
    - `files` rows no record points to (a replaced excuse document), with their bytes;
    - storage objects with no `files` row (written by a request that then rolled back).
    Each row is committed on its own, after its bytes are gone, so a failure leaves at most a row
    whose bytes are already removed, never bytes that something still uses."""
    cutoff = (now or datetime.now(UTC)) - CLEANUP_GRACE
    storage = get_storage()
    referenced = db.query(AttendanceDocument.file_id).filter(AttendanceDocument.file_id.isnot(None))
    rows = db.query(StoredFile).filter(StoredFile.created_at < cutoff, StoredFile.id.notin_(referenced)).all()
    removed_rows = 0
    for row in rows:
        try:
            storage.delete(row.storage_key)
            db.delete(row)
            db.commit()
            removed_rows += 1
        except Exception:
            db.rollback()
            logger.exception("could not remove unreferenced file %s", row.id)

    known = {key for (key,) in db.query(StoredFile.storage_key)}
    removed_objects = 0
    for key in list(storage.list_keys(cutoff)):
        if key in known:
            continue
        try:
            storage.delete(key)
            removed_objects += 1
        except Exception:
            logger.exception("could not remove stray storage object %s", key)
    return removed_rows, removed_objects

