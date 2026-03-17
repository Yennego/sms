import io
import os
from uuid import uuid4
from pathlib import Path
from PIL import Image, UnidentifiedImageError
from starlette.concurrency import run_in_threadpool
from fastapi import UploadFile, HTTPException

async def process_profile_image(file: UploadFile, target_size=(300, 300)) -> bytes:
    """
    Process an uploaded image: resize, convert to RGB, and optimize.
    Runs CPU-bound operations in a threadpool to avoid blocking the event loop.
    """
    try:
        content = await file.read()
        
        # CPU-bound Image processing
        def _process():
            try:
                img = Image.open(io.BytesIO(content))
                img = img.convert("RGB")
                img.thumbnail(target_size, Image.Resampling.LANCZOS)
                
                output = io.BytesIO()
                img.save(output, format="JPEG", quality=85, optimize=True)
                return output.getvalue()
            except UnidentifiedImageError:
                raise ValueError("Invalid image file")

        # Run in threadpool to keep FastAPI async loop responsive
        processed_bytes = await run_in_threadpool(_process)
        return processed_bytes

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image processing error: {str(e)}")
    finally:
        await file.seek(0)  # Reset file pointer if needed later

def generate_safe_filename(original_filename: str) -> str:
    """Ignore original filename and generate a unique UUID-based name."""
    ext = Path(original_filename).suffix.lower()
    if ext not in [".jpg", ".jpeg", ".png", ".webp"]:
        ext = ".jpg"  # Default to jpg if extension is missing or weird
    return f"{uuid4()}{ext}"
