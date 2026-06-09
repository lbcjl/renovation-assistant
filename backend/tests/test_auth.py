"""Tests for the authentication endpoints."""

import pytest
from fastapi.testclient import TestClient

from app.main import app


def test_login_success(client: TestClient) -> None:
    """Test successful login with valid credentials."""
    response = client.post(
        "/auth/login",
        json={"username": "admin", "password": "Admin123"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["username"] == "admin"
    assert len(data["access_token"]) > 20


def test_login_wrong_password(client: TestClient) -> None:
    """Test login with incorrect password."""
    response = client.post(
        "/auth/login",
        json={"username": "admin", "password": "WrongPassword"},
    )
    assert response.status_code == 401
    assert "Incorrect username or password" in response.json()["detail"]


def test_login_nonexistent_user(client: TestClient) -> None:
    """Test login with nonexistent username."""
    response = client.post(
        "/auth/login",
        json={"username": "nonexistent", "password": "password"},
    )
    assert response.status_code == 401


def test_get_current_user_with_valid_token(client: TestClient) -> None:
    """Test /auth/me with a valid token."""
    # First login to get a token
    login_response = client.post(
        "/auth/login",
        json={"username": "testuser", "password": "Test1234"},
    )
    assert login_response.status_code == 200
    token = login_response.json()["access_token"]

    # Then access /auth/me with the token
    response = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "testuser"
    assert data["is_active"] is True


def test_get_current_user_without_token(client: TestClient) -> None:
    """Test /auth/me without providing a token."""
    response = client.get("/auth/me")
    assert response.status_code == 401  # HTTPBearer returns 401 for missing auth


def test_get_current_user_with_invalid_token(client: TestClient) -> None:
    """Test /auth/me with an invalid token."""
    response = client.get(
        "/auth/me",
        headers={"Authorization": "Bearer invalid_token_string"},
    )
    assert response.status_code == 401


@pytest.fixture
def client() -> TestClient:
    """Create a test client for the FastAPI app."""
    return TestClient(app)
