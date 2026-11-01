"""Where uploaded bytes live (phase6-design.md §1 "Files"): the local disk for development, or an
S3-compatible bucket (FILE_STORAGE=s3) in production. Postgres keeps only the `files` row.

Keys are "<tenant_id>/<file_id>": opaque, never built from the uploaded file name.
"""
import os
from datetime import datetime, UTC
from pathlib import Path
from typing import Iterator, Optional

from src.core.config import settings

BACKEND_DIR = Path(__file__).resolve().parents[3]


class FileStorageError(RuntimeError):
    pass


class FileStorage:
    """put/get/delete bytes by key."""

    name = "base"

    def put(self, key: str, data: bytes, content_type: str) -> None:
        raise NotImplementedError

    def get(self, key: str) -> bytes:
        raise NotImplementedError

    def delete(self, key: str) -> None:
        raise NotImplementedError

    def list_keys(self, older_than: datetime) -> Iterator[str]:
        """Every key last written before `older_than` (for the cleanup of unreferenced files)."""
        raise NotImplementedError


class LocalFileStorage(FileStorage):
    name = "local"

    def __init__(self, root):
        root = Path(root)
        self.root = root if root.is_absolute() else BACKEND_DIR / root

    def _path(self, key: str) -> Path:
        path = (self.root / key).resolve()
        if self.root.resolve() not in path.parents:
            raise FileStorageError("Invalid storage key")
        return path

    def put(self, key: str, data: bytes, content_type: str) -> None:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".part")
        tmp.write_bytes(data)
        os.replace(tmp, path)  # never leaves a half-written file under the real key

    def get(self, key: str) -> bytes:
        try:
            return self._path(key).read_bytes()
        except FileNotFoundError:
            raise FileStorageError(f"File {key} is missing from storage")

    def delete(self, key: str) -> None:
        self._path(key).unlink(missing_ok=True)

    def list_keys(self, older_than: datetime) -> Iterator[str]:
        if not self.root.exists():
            return
        cutoff = older_than.timestamp()
        for path in self.root.rglob("*"):
            if path.is_file() and path.suffix != ".part" and path.stat().st_mtime < cutoff:
                yield path.relative_to(self.root).as_posix()


class S3FileStorage(FileStorage):
    """Any S3-compatible bucket (AWS, Railway buckets, Cloudflare R2, MinIO). boto3 is imported
    only here, so the app runs without it while FILE_STORAGE=local."""

    name = "s3"

    def __init__(self, bucket: str, endpoint_url: Optional[str] = None, access_key_id: Optional[str] = None,
                 secret_access_key: Optional[str] = None, region: Optional[str] = None):
        if not bucket:
            raise FileStorageError("FILE_STORAGE=s3 needs S3_BUCKET")
        try:
            import boto3
        except ImportError:
            raise FileStorageError("FILE_STORAGE=s3 needs the boto3 package (poetry add boto3)")
        self.bucket = bucket
        self.client = boto3.client("s3", endpoint_url=endpoint_url or None, aws_access_key_id=access_key_id or None,
                                   aws_secret_access_key=secret_access_key or None, region_name=region or None)

    def put(self, key: str, data: bytes, content_type: str) -> None:
        self.client.put_object(Bucket=self.bucket, Key=key, Body=data, ContentType=content_type)

    def get(self, key: str) -> bytes:
        try:
            return self.client.get_object(Bucket=self.bucket, Key=key)["Body"].read()
        except self.client.exceptions.NoSuchKey:
            raise FileStorageError(f"File {key} is missing from storage")

    def delete(self, key: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=key)

    def list_keys(self, older_than: datetime) -> Iterator[str]:
        cutoff = older_than if older_than.tzinfo else older_than.replace(tzinfo=UTC)
        for page in self.client.get_paginator("list_objects_v2").paginate(Bucket=self.bucket):
            for obj in page.get("Contents", []):
                if obj["LastModified"] < cutoff:
                    yield obj["Key"]


_storage: Optional[FileStorage] = None


def get_storage() -> FileStorage:
    """The storage configured in settings (built once). Tests replace it with set_storage()."""
    global _storage
    if _storage is None:
        _storage = build_storage()
    return _storage


def set_storage(storage: Optional[FileStorage]) -> None:
    global _storage
    _storage = storage


def build_storage() -> FileStorage:
    kind = (settings.FILE_STORAGE or "local").lower()
    if kind == "local":
        return LocalFileStorage(settings.FILE_STORAGE_DIR or "storage")
    if kind == "s3":
        return S3FileStorage(settings.S3_BUCKET, settings.S3_ENDPOINT_URL, settings.S3_ACCESS_KEY_ID,
                             settings.S3_SECRET_ACCESS_KEY, settings.S3_REGION)
    raise FileStorageError(f"Unknown FILE_STORAGE {settings.FILE_STORAGE!r}: use local or s3")
