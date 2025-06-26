import pytest
from uuid import uuid4

# Import all auth models to ensure they're registered with SQLAlchemy
from src.db.models.auth import User, UserRole, Permission

def test_permission_creation(db_session):
    """Test creating a new permission."""
    permission = Permission(
        name="manage_users",
        description="Can manage user accounts"
    )
    db_session.add(permission)
    db_session.commit()
    
    assert permission.id is not None
    assert permission.name == "manage_users"
    assert permission.description == "Can manage user accounts"
    assert len(permission.roles) == 0

def test_permission_required_fields(db_session):
    """Test that required fields are enforced."""
    with pytest.raises(ValueError):
        Permission(description="Missing name")

def test_permission_unique_name(db_session):
    """Test that permission names must be unique."""
    permission1 = Permission(name="unique_permission")
    db_session.add(permission1)
    db_session.commit()
    
    permission2 = Permission(name="unique_permission")
    db_session.add(permission2)
    with pytest.raises(Exception):  # SQLAlchemy unique constraint violation
        db_session.commit()

def test_permission_roles_relationship(db_session):
    """Test the relationship between permissions and roles."""
    permission = Permission(name="test_permission")
    role = UserRole(
        name="admin",
        description="Administrator role"
    )
    permission.roles.append(role)
    
    db_session.add(permission)
    db_session.commit()
    
    assert len(permission.roles) == 1
    assert permission.roles[0] == role
    assert permission in role.permissions