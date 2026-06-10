"""Tests for /settings/{provider} endpoints and per-request chat model override."""

from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.main import app
from app.routers import provider_settings as settings_router
from app.services import runtime_config

from .conftest import FakeProvider


def _settings(**overrides: str) -> Settings:
    """Build Settings without reading the local .env file."""
    defaults: dict[str, str] = {
        "llm_api_key": "test-llm-key-1234567890",
        "llm_base_url": "https://relay.example/v1",
        "llm_model": "claude-opus-4-6",
        "image_api_key": "test-image-key-1234567890",
        "image_base_url": "https://image.example/v1",
        "image_model": "gpt-image-2",
    }
    defaults.update(overrides)
    return Settings(_env_file=None, **defaults)


@pytest.fixture
def settings_client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    # Point the persisted config at a temp file so tests never touch real data.
    monkeypatch.setattr(runtime_config, "CONFIG_PATH", tmp_path / "provider_config.json")
    # Wrap in a zero-arg lambda: FastAPI inspects the override's signature, so
    # passing ``_settings`` (which takes **overrides) directly would fail.
    app.dependency_overrides[get_settings] = lambda: _settings()
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()


def test_get_settings_returns_env_defaults_with_masked_key(settings_client: TestClient) -> None:
    response = settings_client.get("/settings/llm")

    assert response.status_code == 200
    body = response.json()
    assert body["base_url"] == "https://relay.example/v1"
    assert body["model"] == "claude-opus-4-6"
    assert body["api_key_set"] is True
    assert body["api_key_preview"] == "test-l...7890"
    assert "test-llm-key" not in body["api_key_preview"]


def test_get_settings_for_image_uses_image_defaults(settings_client: TestClient) -> None:
    response = settings_client.get("/settings/image")

    assert response.status_code == 200
    body = response.json()
    assert body["base_url"] == "https://image.example/v1"
    assert body["model"] == "gpt-image-2"


def test_get_settings_rejects_unknown_provider(settings_client: TestClient) -> None:
    assert settings_client.get("/settings/nope").status_code == 422


def test_put_settings_persists_and_get_reflects(settings_client: TestClient) -> None:
    response = settings_client.put(
        "/settings/llm",
        json={
            "base_url": "https://new-relay.example/v1",
            "api_key": "new-key-abcdefghijkl",
            "model": "gpt-5.4",
        },
    )

    assert response.status_code == 200
    body = settings_client.get("/settings/llm").json()
    assert body["base_url"] == "https://new-relay.example/v1"
    assert body["model"] == "gpt-5.4"
    assert body["api_key_preview"] == "new-ke...ijkl"


def test_put_settings_empty_key_keeps_saved_key(settings_client: TestClient) -> None:
    settings_client.put(
        "/settings/llm",
        json={
            "base_url": "https://relay.example/v1",
            "api_key": "saved-key-abcdefghij",
            "model": "claude-opus-4-6",
        },
    )

    response = settings_client.put(
        "/settings/llm",
        json={"base_url": "https://relay.example/v1", "model": "gpt-5.4"},
    )

    assert response.status_code == 200
    assert response.json()["api_key_preview"] == "saved-...ghij"


def test_put_settings_without_any_key_returns_400(settings_client: TestClient) -> None:
    app.dependency_overrides[get_settings] = lambda: _settings(llm_api_key="")

    response = settings_client.put(
        "/settings/llm",
        json={"base_url": "https://relay.example/v1", "model": "gpt-5.4"},
    )

    assert response.status_code == 400


def test_put_settings_rejects_non_http_base_url(settings_client: TestClient) -> None:
    response = settings_client.put(
        "/settings/llm",
        json={"base_url": "ftp://relay.example", "model": "gpt-5.4"},
    )

    assert response.status_code == 422


def test_saving_llm_keeps_image_section(settings_client: TestClient) -> None:
    settings_client.put(
        "/settings/image",
        json={
            "base_url": "https://new-image.example/v1",
            "api_key": "image-key-abcdefghij",
            "model": "gpt-image-3",
        },
    )
    settings_client.put(
        "/settings/llm",
        json={
            "base_url": "https://new-relay.example/v1",
            "api_key": "llm-key-abcdefghijkl",
            "model": "gpt-5.4",
        },
    )

    body = settings_client.get("/settings/image").json()
    assert body["base_url"] == "https://new-image.example/v1"
    assert body["model"] == "gpt-image-3"


def test_fetch_models_uses_request_credentials(
    settings_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_fetch(base_url: str, api_key: str, proxy_url: str = "") -> list[str]:
        assert base_url == "https://probe.example/v1"
        assert api_key == "probe-key"
        return ["claude-opus-4-6", "gpt-5.4-mini"]

    monkeypatch.setattr(settings_router, "_fetch_model_ids", fake_fetch)

    response = settings_client.post(
        "/settings/llm/models",
        json={"base_url": "https://probe.example/v1", "api_key": "probe-key"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "models": ["claude-opus-4-6", "gpt-5.4-mini"],
        "default": "claude-opus-4-6",
    }


def test_fetch_models_falls_back_to_saved_credentials(
    settings_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_fetch(base_url: str, api_key: str, proxy_url: str = "") -> list[str]:
        assert base_url == "https://relay.example/v1"
        assert api_key == "test-llm-key-1234567890"
        return ["claude-opus-4-6"]

    monkeypatch.setattr(settings_router, "_fetch_model_ids", fake_fetch)

    response = settings_client.post("/settings/llm/models", json={})

    assert response.status_code == 200


def test_fetch_models_without_key_returns_503(settings_client: TestClient) -> None:
    app.dependency_overrides[get_settings] = lambda: _settings(llm_api_key="")

    response = settings_client.post("/settings/llm/models", json={})

    assert response.status_code == 503


def test_fetch_models_upstream_failure_returns_502(
    settings_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def failing_fetch(base_url: str, api_key: str, proxy_url: str = "") -> list[str]:
        raise httpx.ConnectError("boom")

    monkeypatch.setattr(settings_router, "_fetch_model_ids", failing_fetch)

    response = settings_client.post("/settings/llm/models", json={})

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
