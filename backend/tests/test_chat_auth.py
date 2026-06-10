"""Tests for temporarily unauthenticated chat endpoints."""

from fastapi.testclient import TestClient

from app.main import app


def test_chat_does_not_require_authentication() -> None:
    """Test that /chat no longer returns 401 without a token in test mode."""
    with TestClient(app) as client:
        response = client.post(
            "/chat",
            json={"messages": [{"role": "user", "content": "Hello"}]},
        )
        assert response.status_code != 401


def test_chat_stream_does_not_require_authentication() -> None:
    """Test that /chat/stream no longer returns 401 without a token in test mode."""
    with TestClient(app) as client:
        response = client.post(
            "/chat/stream",
            json={"messages": [{"role": "user", "content": "Hello"}]},
        )
        assert response.status_code != 401


def test_chat_works_with_valid_token() -> None:
    """Test that /chat still accepts requests with an authentication token."""
    with TestClient(app) as client:
        # Login to get token
        login_response = client.post(
            "/auth/login",
            json={"username": "admin", "password": "Admin123"},
        )
        assert login_response.status_code == 200
        token = login_response.json()["access_token"]

        # Try to chat with the token
        response = client.post(
            "/chat",
            json={"messages": [{"role": "user", "content": "卫生间防水"}]},
            headers={"Authorization": f"Bearer {token}"},
        )
        # Should succeed (200) or fail due to LLM config (502), but not auth failure (401)
        assert response.status_code in (200, 502)
