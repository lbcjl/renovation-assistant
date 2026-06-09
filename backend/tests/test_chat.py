"""Tests for the /chat endpoint (using a fake LLM provider)."""

from fastapi.testclient import TestClient

from tests.conftest import FakeProvider


def test_chat_returns_provider_reply(client: TestClient) -> None:
    response = client.post(
        "/chat",
        json={"messages": [{"role": "user", "content": "贴瓷砖前要做什么准备？"}]},
    )
    assert response.status_code == 200
    assert response.json() == {"reply": "测试回复"}


def test_chat_prepends_system_prompt(client: TestClient, fake_provider: FakeProvider) -> None:
    client.post("/chat", json={"messages": [{"role": "user", "content": "你好"}]})
    assert fake_provider.received is not None
    assert fake_provider.received[0].role == "system"
    assert fake_provider.received[-1].content == "你好"


def test_chat_rejects_empty_messages(client: TestClient) -> None:
    response = client.post("/chat", json={"messages": []})
    assert response.status_code == 422
