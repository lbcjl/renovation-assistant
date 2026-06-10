"""Test image generation endpoint."""

from fastapi.testclient import TestClient

from app.main import app
from app.routers.image import get_image_service


class FakeImageService:
    """Fake image service for endpoint tests."""

    async def generate_image(self, prompt: str) -> str:
        return f"https://example.test/generated?prompt={prompt}"


def test_generate_image_does_not_require_auth() -> None:
    """Image generation is temporarily available without authentication."""
    app.dependency_overrides[get_image_service] = FakeImageService
    try:
        with TestClient(app) as client:
            response = client.post(
                "/image/generate",
                json={"prompt": "a modern kitchen with white cabinets"},
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["image_url"].startswith("https://example.test/generated")


def test_generate_image_validates_prompt() -> None:
    """Empty prompt is rejected."""
    app.dependency_overrides[get_image_service] = FakeImageService
    with TestClient(app) as client:
        response = client.post(
            "/image/generate",
            json={"prompt": ""},
        )
    app.dependency_overrides.clear()
    assert response.status_code == 422


def test_generate_image_prompt_too_long() -> None:
    """Prompt exceeding 1000 chars is rejected."""
    app.dependency_overrides[get_image_service] = FakeImageService
    with TestClient(app) as client:
        response = client.post(
            "/image/generate",
            json={"prompt": "a" * 1001},
        )
    app.dependency_overrides.clear()
    assert response.status_code == 422
