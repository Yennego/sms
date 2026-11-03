"""Signature and school-seal images (docs/remodel/phase4-design.md §6, "Upload rules").

One place decides what an uploaded image may be and what we store:
- at most MAX_UPLOAD_BYTES uploaded;
- the real type is sniffed by Pillow, which is only allowed to try the PNG and JPEG decoders
  (the file name and the declared content type are ignored);
- decompression bombs are refused before decoding (MAX_PIXELS, and Pillow's own
  DecompressionBombWarning/Error are treated as errors);
- JPEG orientation is applied, then everything is redrawn into a fresh RGBA image, so no
  metadata (EXIF, GPS, ICC, text chunks) survives;
- signatures: empty margins (transparent or near-white) are trimmed; seals: transparent margins;
- scaled down (never up) to fit 600x200 (signature) or 400x400 (seal), saved as PNG.

Images are returned to clients only as data URLs inside the responses that may show them.
"""
import base64
import hashlib
import io
import warnings
from dataclasses import dataclass
from typing import Optional, Tuple

from PIL import Image, ImageChops, ImageOps, UnidentifiedImageError

MAX_UPLOAD_BYTES = 1024 * 1024  # 1 MB
MAX_PIXELS = 25_000_000  # e.g. 5000 x 5000; larger images are refused before decoding
SIGNATURE_BOX = (600, 200)
SEAL_BOX = (400, 400)
ALLOWED_FORMATS = ("PNG", "JPEG")
TRIM_PADDING = 4


class ImageRejected(ValueError):
    """The upload isn't an acceptable image. status_code: 413 (too large) or 422."""

    def __init__(self, message: str, status_code: int = 422):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


@dataclass
class CleanImage:
    data: bytes  # PNG
    width: int
    height: int
    sha256: str


def _open(raw: bytes) -> Image.Image:
    if not raw:
        raise ImageRejected("The file is empty.")
    if len(raw) > MAX_UPLOAD_BYTES:
        raise ImageRejected("The image is larger than 1 MB.", 413)
    with warnings.catch_warnings():
        warnings.simplefilter("error", Image.DecompressionBombWarning)
        try:
            # Only the PNG and JPEG decoders may look at the bytes
            with Image.open(io.BytesIO(raw), formats=ALLOWED_FORMATS) as probe:
                if probe.format not in ALLOWED_FORMATS:
                    raise ImageRejected("Upload a PNG or JPEG image.")
                if probe.width * probe.height > MAX_PIXELS:
                    raise ImageRejected("The image has too many pixels.")
                probe.verify()  # structure and checksums, without decoding the pixels
            img = Image.open(io.BytesIO(raw), formats=ALLOWED_FORMATS)
            img.load()
        except ImageRejected:
            raise
        except (Image.DecompressionBombError, Image.DecompressionBombWarning):
            raise ImageRejected("The image has too many pixels.")
        except (UnidentifiedImageError, OSError, SyntaxError, ValueError, EOFError):
            raise ImageRejected("Upload a PNG or JPEG image.")
    return img


def _to_rgba(img: Image.Image) -> Image.Image:
    if getattr(img, "n_frames", 1) > 1:  # animated PNG: first frame only
        img.seek(0)
    if img.format == "JPEG":
        img = ImageOps.exif_transpose(img)
    if img.mode == "P" or img.mode == "PA":
        img = img.convert("RGBA")
    elif img.mode in ("CMYK", "YCbCr", "I", "I;16", "F", "1", "L"):
        img = img.convert("RGB")
    rgba = img.convert("RGBA")
    # A fresh image: nothing from the original's info/metadata is carried over
    return Image.frombytes("RGBA", rgba.size, rgba.tobytes())


def _content_bbox(img: Image.Image, *, white_is_empty: bool) -> Optional[Tuple[int, int, int, int]]:
    alpha = img.getchannel("A").point(lambda v: 255 if v > 16 else 0)
    if not white_is_empty:
        return alpha.getbbox()
    ink = ImageOps.invert(img.convert("RGB").convert("L")).point(lambda v: 255 if v > 20 else 0)
    return ImageChops.multiply(alpha, ink).getbbox()


def _trim(img: Image.Image, *, white_is_empty: bool) -> Image.Image:
    box = _content_bbox(img, white_is_empty=white_is_empty)
    if box is None:
        raise ImageRejected("The image is empty.")
    left, top, right, bottom = box
    p = TRIM_PADDING
    return img.crop((max(0, left - p), max(0, top - p), min(img.width, right + p), min(img.height, bottom + p)))


def _finish(img: Image.Image, box: Tuple[int, int]) -> CleanImage:
    img.thumbnail(box, Image.Resampling.LANCZOS)  # only ever shrinks
    out = io.BytesIO()
    img.save(out, format="PNG", optimize=True)
    data = out.getvalue()
    return CleanImage(data=data, width=img.width, height=img.height, sha256=hashlib.sha256(data).hexdigest())


def normalise_signature(raw: bytes) -> CleanImage:
    img = _trim(_to_rgba(_open(raw)), white_is_empty=True)
    return _finish(img, SIGNATURE_BOX)


def normalise_seal(raw: bytes) -> CleanImage:
    img = _trim(_to_rgba(_open(raw)), white_is_empty=False)
    return _finish(img, SEAL_BOX)


def normalise_logo(raw: bytes) -> CleanImage:
    """The school logo: handled like the seal (transparent margins trimmed, fits 400x400)."""
    return normalise_seal(raw)


async def read_upload(file) -> bytes:
    """Read an UploadFile, refusing more than MAX_UPLOAD_BYTES without reading it all."""
    raw = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(raw) > MAX_UPLOAD_BYTES:
        raise ImageRejected("The image is larger than 1 MB.", 413)
    return raw


def data_url(png: Optional[bytes]) -> Optional[str]:
    if not png:
        return None
    return "data:image/png;base64," + base64.b64encode(png).decode("ascii")
