import pytest
from uuid import uuid4
from src.db.models.auth.user import User

def test_user_creation():
    """Test creating a new user with valid data."""
    user = User(
        email="test@example.com",
        password_hash="hashed_password",
        first_name="John",
        last_name="Doe",
        tenant_id=uuid4()
    )
    
    assert user.email == "test@example.com"
    assert user.password_hash == "hashed_password"
    assert user.first_name == "John"
    assert user.last_name == "Doe"
    assert user.is_active is True
    assert user.roles == []

def test_user_required_fields():
    """Test that required fields are enforced."""
    with pytest.raises(ValueError, match="email is required for user"):
        User(password_hash="hash", first_name="John", last_name="Doe", tenant_id=uuid4())
        
    with pytest.raises(ValueError, match="password_hash is required for user"):
        User(email="test@example.com", first_name="John", last_name="Doe", tenant_id=uuid4())
        
    with pytest.raises(ValueError, match="first_name is required for user"):
        User(email="test@example.com", password_hash="hash", last_name="Doe", tenant_id=uuid4())
        
    with pytest.raises(ValueError, match="last_name is required for user"):
        User(email="test@example.com", password_hash="hash", first_name="John", tenant_id=uuid4())
        
    with pytest.raises(ValueError, match="tenant_id is required for user"):
        User(email="test@example.com", password_hash="hash", first_name="John", last_name="Doe")

def test_user_is_active_default():
    """Test that is_active defaults to True."""
    user = User(
        email="test@example.com",
        password_hash="hashed_password",
        first_name="John",
        last_name="Doe",
        tenant_id=uuid4()
    )
    assert user.is_active is True

def test_user_is_active_explicit():
    """Test setting is_active explicitly."""
    user = User(
        email="test@example.com",
        password_hash="hashed_password",
        first_name="John",
        last_name="Doe",
        is_active=False,
        tenant_id=uuid4()
    )
    assert user.is_active is False 

    