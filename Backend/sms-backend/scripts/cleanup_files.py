"""Remove stored files nothing refers to any more (replaced excuse documents, uploads from
requests that rolled back), once they are a day old. Run daily:

    python -m scripts.cleanup_files
"""
import logging
import sys

from src.db.session import platform_session
import src.db.models  # noqa: F401  registers every model
from src.services.files import cleanup_unreferenced

logger = logging.getLogger("cleanup_files")


def main() -> int:
    db = platform_session()  # every school's files
    try:
        rows, objects = cleanup_unreferenced(db)
    except Exception:
        logger.exception("cleanup failed")
        return 1
    finally:
        db.close()
    logger.info("done: %d unreferenced files and %d stray storage objects removed", rows, objects)
    return 0


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    sys.exit(main())
