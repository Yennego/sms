import logging
from sqlalchemy.orm import Session

from src.db.base import Base
from src.db.session import engine
from src.db.models.tenant import Tenant
from src.core.security import get_password_hash
from src.db.models.user import User

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def init_db(db: Session) -> None:
    # Create tables
    Base.metadata.create_all(bind=engine)
    logger.info("Created database tables")

    # Create default tenant if it doesn't exist
    tenant = db.query(Tenant).filter(Tenant.slug == "default").first()
    if not tenant:
        tenant = Tenant(
            name="Default Tenant",
            slug="default",
            domain="localhost",
            is_active=True,
            settings={}
        )
        db.add(tenant)
        db.commit()
        db.refresh(tenant)
        logger.info("Created default tenant")

    # Create superuser if it doesn't exist
    user = db.query(User).filter(User.email == "admin@example.com").first()
    if not user:
        user = User(
            email="admin@example.com",
            hashed_password=get_password_hash("admin"),
            full_name="Admin User",
            is_active=True,
            is_superuser=True,
            tenant_id=tenant.id
        )
        db.add(user)
        db.commit()
        logger.info("Created superuser")


if __name__ == "__main__":
    from src.db.session import SessionLocal
    db = SessionLocal()
    init_db(db)
    db.close() 