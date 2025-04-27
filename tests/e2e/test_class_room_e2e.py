import pytest
from fastapi.testclient import TestClient
from uuid import UUID
from typing import Dict, Any

from main import app
from src.db.session import get_db
from src.core.middleware.tenant import get_tenant_id_from_request
from src.schemas.class_room import ClassRoomCreate, ClassRoomUpdate


client = TestClient(app)


@pytest.fixture
def test_tenant_id() -> UUID:
    """Fixture to provide a test tenant ID."""
    return UUID("123e4567-e89b-12d3-a456-426614174000")


@pytest.fixture
def test_class_room_data() -> Dict[str, Any]:
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
def test_bulk_class_room_data() -> list[Dict[str, Any]]:
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


def test_create_class_room(client, test_tenant_id, test_class_room_data):
    """Test creating a new class room."""
    response = client.post(
        "/api/v1/class-rooms",
        json=test_class_room_data,
        headers={"X-Tenant-ID": str(test_tenant_id)}
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == test_class_room_data["name"]
    assert data["grade_level"] == test_class_room_data["grade_level"]
    assert data["subject"] == test_class_room_data["subject"]
    assert data["room_number"] == test_class_room_data["room_number"]
    assert data["max_capacity"] == test_class_room_data["max_capacity"]
    assert data["is_active"] == test_class_room_data["is_active"]


def test_create_duplicate_class_room(test_tenant_id: UUID, test_class_room_data: Dict[str, Any]):
    """Test creating a duplicate class room."""
    # First create
    client.post(
        "/api/v1/class-rooms",
        json=test_class_room_data,
        headers={"X-Tenant-ID": str(test_tenant_id)}
    )
    
    # Try to create duplicate
    response = client.post(
        "/api/v1/class-rooms",
        json=test_class_room_data,
        headers={"X-Tenant-ID": str(test_tenant_id)}
    )
    assert response.status_code == 400
    assert "already exists" in response.json()["detail"]


def test_get_class_room(client, test_tenant_id, test_class_room_data):
    """Test retrieving a class room by ID."""
    # First create a class room
    create_response = client.post(
        "/api/v1/class-rooms",
        json=test_class_room_data,
        headers={"X-Tenant-ID": str(test_tenant_id)}
    )
    assert create_response.status_code == 201
    class_room_id = create_response.json()["id"]
    
    # Then retrieve it
    response = client.get(
        f"/api/v1/class-rooms/{class_room_id}",
        headers={"X-Tenant-ID": str(test_tenant_id)}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == class_room_id
    assert data["name"] == test_class_room_data["name"]


def test_get_nonexistent_class_room(test_tenant_id: UUID):
    """Test getting a non-existent class room."""
    response = client.get(
        "/api/v1/class-rooms/123e4567-e89b-12d3-a456-426614174000",
        headers={"X-Tenant-ID": str(test_tenant_id)}
    )
    assert response.status_code == 404


def test_list_class_rooms(client, test_tenant_id, test_class_room_data):
    """Test listing class rooms."""
    # First create a class room
    create_response = client.post(
        "/api/v1/class-rooms",
        json=test_class_room_data,
        headers={"X-Tenant-ID": str(test_tenant_id)}
    )
    assert create_response.status_code == 201
    
    # Then list all class rooms
    response = client.get(
        "/api/v1/class-rooms",
        headers={"X-Tenant-ID": str(test_tenant_id)}
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0
    assert data[0]["name"] == test_class_room_data["name"]


def test_update_class_room(client, test_tenant_id, test_class_room_data):
    """Test updating a class room."""
    # First create a class room
    create_response = client.post(
        "/api/v1/class-rooms",
        json=test_class_room_data,
        headers={"X-Tenant-ID": str(test_tenant_id)}
    )
    assert create_response.status_code == 201
    class_room_id = create_response.json()["id"]
    
    # Then update it
    update_data = {
        "name": "Updated Mathematics 101",
        "max_capacity": 35
    }
    response = client.patch(
        f"/api/v1/class-rooms/{class_room_id}",
        json=update_data,
        headers={"X-Tenant-ID": str(test_tenant_id)}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == class_room_id
    assert data["name"] == update_data["name"]
    assert data["max_capacity"] == update_data["max_capacity"]


def test_delete_class_room(client, test_tenant_id, test_class_room_data):
    """Test deleting a class room."""
    # First create a class room
    create_response = client.post(
        "/api/v1/class-rooms",
        json=test_class_room_data,
        headers={"X-Tenant-ID": str(test_tenant_id)}
    )
    assert create_response.status_code == 201
    class_room_id = create_response.json()["id"]
    
    # Then delete it
    response = client.delete(
        f"/api/v1/class-rooms/{class_room_id}",
        headers={"X-Tenant-ID": str(test_tenant_id)}
    )
    assert response.status_code == 204
    
    # Verify it's deleted
    get_response = client.get(
        f"/api/v1/class-rooms/{class_room_id}",
        headers={"X-Tenant-ID": str(test_tenant_id)}
    )
    assert get_response.status_code == 404


def test_bulk_create_class_rooms(client, test_tenant_id, test_bulk_class_room_data):
    """Test bulk creating class rooms."""
    response = client.post(
        "/api/v1/class-rooms/bulk",
        json=test_bulk_class_room_data,
        headers={"X-Tenant-ID": str(test_tenant_id)}
    )
    assert response.status_code == 201
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == len(test_bulk_class_room_data)
    assert data[0]["name"] == test_bulk_class_room_data[0]["name"]
    assert data[1]["name"] == test_bulk_class_room_data[1]["name"]


def test_bulk_delete_class_rooms(test_tenant_id: UUID, test_bulk_class_room_data: list[Dict[str, Any]]):
    """Test bulk deleting class rooms."""
    # First create class rooms
    create_response = client.post(
        "/api/v1/class-rooms/bulk",
        json=test_bulk_class_room_data,
        headers={"X-Tenant-ID": str(test_tenant_id)}
    )
    class_room_ids = [item["id"] for item in create_response.json()]
    
    # Then delete them
    response = client.delete(
        "/api/v1/class-rooms/bulk",
        json=class_room_ids,
        headers={"X-Tenant-ID": str(test_tenant_id)}
    )
    assert response.status_code == 200
    assert response.json() == {"ok": True}
    
    # Verify they're deleted
    for class_room_id in class_room_ids:
        get_response = client.get(
            f"/api/v1/class-rooms/{class_room_id}",
            headers={"X-Tenant-ID": str(test_tenant_id)}
        )
        assert get_response.status_code == 404 