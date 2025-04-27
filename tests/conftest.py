import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from uuid import UUID
from datetime import datetime

from main import app
from src.db.session import get_db
from src.db.base import Base
from src.core.config import settings
from src.db.models.tenant import Tenant


# Create test database
SQLALCHEMY_DATABASE_URL = "postgresql://postgres:199922@localhost:5432/postgres"
engine = create_engine(SQLALCHEMY_DATABASE_URL)

# Create test database
try:
    with engine.connect() as conn:
        conn.execute(text("COMMIT"))  # Close any open transactions
        conn.execute(text("DROP DATABASE IF EXISTS sms_test_db"))
        conn.execute(text("CREATE DATABASE sms_test_db"))
except Exception as e:
    print(f"Error creating test database: {e}")

# Connect to test database
SQLALCHEMY_TEST_DATABASE_URL = "postgresql://postgres:199922@localhost:5432/sms_test_db"
test_engine = create_engine(SQLALCHEMY_TEST_DATABASE_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="session")
def test_db():
    """Create test database tables."""
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture(scope="function")
def db_session(test_db):
    """Create a fresh database session for each test."""
    connection = test_engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    
    yield session
    
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture(scope="function")
def test_tenant(db_session):
    """Create a test tenant."""
    tenant = Tenant(
        id=UUID("123e4567-e89b-12d3-a456-426614174000"),
        name="Test Tenant",
        slug="test-tenant",
        domain="testserver",
        is_active=True,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db_session.add(tenant)
    db_session.commit()
    return tenant


@pytest.fixture(scope="function")
def client(db_session, test_tenant):
    """Create a test client with a fresh database session."""
    def override_get_db():
        try:
            yield db_session
        finally:
            db_session.close()
    
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def test_tenant_id() -> UUID:
    """Fixture to provide a test tenant ID."""
    return UUID("123e4567-e89b-12d3-a456-426614174000")


@pytest.fixture
def test_class_room_data() -> dict:
    """Fixture to provide test class room data."""
    return {
        "name": "Mathematics 101",
        "grade_level": "Grade 10",
        "subject": "Mathematics",
        "room_number": "Room 101",
        "max_capacity": 30,
        "is_active": True
    }


@pytest.fixture
def test_bulk_class_room_data() -> list[dict]:
    """Fixture to provide test bulk class room data."""
    return [
        {
            "name": "Physics 101",
            "grade_level": "Grade 11",
            "subject": "Physics",
            "room_number": "Room 102",
            "max_capacity": 25,
            "is_active": True
        },
        {
            "name": "Chemistry 101",
            "grade_level": "Grade 11",
            "subject": "Chemistry",
            "room_number": "Room 103",
            "max_capacity": 25,
            "is_active": True
        }
    ] 