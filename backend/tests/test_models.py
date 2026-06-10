"""Tests for the /models endpoint and per-request model override."""

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.main import app
from app.routers import models as models_router

from .conftest import FakeProvider


def _settings(**overrides: str) -> Settings:
    """Build Settings without reading the local .env file."""
    defaults: dict[str, str] = {
        "llm_api_key": "test-key",
        "llm_base_url": "https://relay.example/v1",
        "llm_model": "claude-opus-4-6",
    }
    defaults.update(overrides)
    return Settings(_env_file=None, **defaults)


@pytest.fixture
def models_client() -> TestClient:
    # Wrap in a zero-arg lambda: FastAPI inspects the override's signature, so
    # passing ``_settings`` (which takes **overrides) directly would fail.
    app.dependency_overrides[get_settings] = lambda: _settings()
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()


def test_list_models_returns_sorted_ids_and_default(
    models_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_fetch(base_url: str, api_key: str) -> list[str]:
        assert base_url == "https://relay.example/v1"
        assert api_key == "test-key"
        return ["claude-opus-4-6", "gpt-5.4-mini"]

    monkeypatch.setattr(models_router, "_fetch_model_ids", fake_fetch)

    response = models_client.get("/models")

    assert response.status_code == 200
    assert response.json() == {
        "models": ["claude-opus-4-6", "gpt-5.4-mini"],
        "default": "claude-opus-4-6",
    }


def test_list_models_without_api_key_returns_503(models_client: TestClient) -> None:
    app.dependency_overrides[get_settings] = lambda: _settings(llm_api_key="")

    response = models_client.get("/models")

    assert response.status_code == 503


def test_list_models_upstream_failure_returns_502(
    models_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def failing_fetch(base_url: str, api_key: str) -> list[str]:
        raise httpx.ConnectError("boom")

    monkeypatch.setattr(models_router, "_fetch_model_ids", failing_fetch)

    response = models_client.get("/models")

    assert response.status_code == 502


def test_chat_passes_model_override_to_provider(
    client: TestClient, fake_provider: FakeProvider
) -> None:
    response = client.post(
        "/chat",
        json={
            "messages": [{"role": "user", "content": "你好"}],
            "model": "gpt-5.4-mini",
        },
    )

    assert response.status_code == 200
    assert fake_provider.received_model == "gpt-5.4-mini"


def test_chat_without_model_uses_configured_default(
    client: TestClient, fake_provider: FakeProvider
) -> None:
    response = client.post(
        "/chat",
        json={"messages": [{"role": "user", "content": "你好"}]},
    )

    assert response.status_code == 200
    assert fake_provider.received_model is None


def test_chat_stream_passes_model_override_to_provider(
    client: TestClient, fake_provider: FakeProvider
) -> None:
    with client.stream(
        "POST",
        "/chat/stream",
        json={
            "messages": [{"role": "user", "content": "你好"}],
            "model": "claude-opus-4-6",
        },
    ) as response:
        assert response.status_code == 200
        response.read()

    assert fake_provider.received_model == "claude-opus-4-6"
