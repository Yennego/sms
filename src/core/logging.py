import logging
import sys

def setup_logging():
    # Configure root logger
    logging.basicConfig(
        level=logging.DEBUG,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        handlers=[
            logging.StreamHandler(sys.stdout)
        ]
    )
    
    # Set specific loggers to appropriate levels
    logging.getLogger("sqlalchemy.engine").setLevel(logging.INFO)
    logging.getLogger("uvicorn").setLevel(logging.INFO)
    logging.getLogger("alembic").setLevel(logging.INFO)