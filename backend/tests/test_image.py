"""Test image generation endpoint."""

import asyncio
from types import SimpleNamespace

import httpx
from fastapi.testclient import TestClient
from openai import APIConnectionError, InternalServerError

from app.config import Settings
from app.main import app
from app.routers.image import get_image_service
from app.services.image_service import ImageGenerationService, ImageGenerationUnavailableError


class FakeImageService:
    """Fake image service for endpoint tests."""

    async def generate_image(self, prompt: str) -> str:
        return f"https://example.test/generated?prompt={prompt}"


class UnavailableImageService:
    """Fake service whose upstream keeps failing transiently."""

    async def generate_image(self, prompt: str) -> str:
        raise ImageGenerationUnavailableError("upstream kept failing")


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


def test_generate_image_unavailable_returns_503() -> None:
    """Exhausted retries surface as 503, not a generic 502."""
    app.dependency_overrides[get_image_service] = UnavailableImageService
    try:
        with TestClient(app) as client:
            response = client.post(
                "/image/generate",
                json={"prompt": "a cozy bedroom"},
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 503
    assert response.json()["detail"] == "Image service temporarily unavailable"


class _FlakyImages:
    """images.generate stub that raises queued errors before succeeding."""

    def __init__(self, outcomes: list[Exception | SimpleNamespace]) -> None:
        self._outcomes = list(outcomes)
        self.calls = 0

    async def generate(self, **_: object) -> SimpleNamespace:
        self.calls += 1
        outcome = self._outcomes.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome


def _url_response(url: str) -> SimpleNamespace:
    return SimpleNamespace(data=[SimpleNamespace(url=url, b64_json=None)])


def _service_with(
    outcomes: list[Exception | SimpleNamespace],
) -> tuple[ImageGenerationService, _FlakyImages]:
    service = ImageGenerationService(Settings(), retry_delay_seconds=0.0)
    images = _FlakyImages(outcomes)
    service._client = SimpleNamespace(images=images)  # noqa: SLF001 - test seam
    return service, images


def _connection_error() -> APIConnectionError:
    request = httpx.Request("POST", "https://example.test/v1/images/generations")
    return APIConnectionError(request=request)


def _server_error() -> InternalServerError:
    request = httpx.Request("POST", "https://example.test/v1/images/generations")
    response = httpx.Response(502, request=request)
    return InternalServerError("upstream 502", response=response, body=None)


def test_generate_image_retries_transient_failure_then_succeeds() -> None:
    """A dropped connection and an upstream 5xx are retried until success."""
    service, images = _service_with(
        [_connection_error(), _server_error(), _url_response("https://example.test/ok.png")]
    )

    url = asyncio.run(service.generate_image("a bright study room"))

    assert url == "https://example.test/ok.png"
    assert images.calls == 3


def test_generate_image_raises_unavailable_after_all_retries() -> None:
    """All-transient failures raise ImageGenerationUnavailableError after 3 attempts."""
    service, images = _service_with(
        [_connection_error(), _connection_error(), _server_error()]
    )

    try:
        asyncio.run(service.generate_image("a bright study room"))
        raise AssertionError("expected ImageGenerationUnavailableError")
    except ImageGenerationUnavailableError:
        pass

    assert images.calls == 3


def test_generate_image_does_not_retry_non_transient_error() -> None:
    """Non-transient errors (e.g. empty response) propagate without retry."""
    service, images = _service_with([SimpleNamespace(data=[])])

    try:
        asyncio.run(service.generate_image("a bright study room"))
        raise AssertionError("expected ValueError")
    except ValueError:
        pass

    assert images.calls == 1
