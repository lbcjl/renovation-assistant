"""Tests for the /chat endpoint (fake LLM + fake retriever, no network)."""

from fastapi.testclient import TestClient

from tests.conftest import FakeProvider


def test_chat_returns_provider_reply(client: TestClient) -> None:
    response = client.post("/chat", json={"messages": [{"role": "user", "content": "你好"}]})
    assert response.status_code == 200
    assert response.json()["reply"] == "测试回复"


def test_chat_rejects_empty_messages(client: TestClient) -> None:
    assert client.post("/chat", json={"messages": []}).status_code == 422


def test_chat_rejects_too_many_messages(client: TestClient) -> None:
    messages = [{"role": "user", "content": "x"} for _ in range(41)]
    assert client.post("/chat", json={"messages": messages}).status_code == 422


def test_chat_rejects_too_long_message(client: TestClient) -> None:
    messages = [{"role": "user", "content": "x" * 4001}]
    assert client.post("/chat", json={"messages": messages}).status_code == 422


def test_chat_without_index_uses_fallback(client: TestClient, fake_provider: FakeProvider) -> None:
    response = client.post(
        "/chat", json={"messages": [{"role": "user", "content": "随便问个问题"}]}
    )
    assert response.status_code == 200
    assert response.json()["sources"] == []
    assert fake_provider.received is not None
    assert fake_provider.received[0].role == "system"
    assert "暂未检索到" in fake_provider.received[0].content


def test_chat_injects_context_and_cites_sources(
    client_with_index: TestClient, fake_provider: FakeProvider
) -> None:
    response = client_with_index.post(
        "/chat", json={"messages": [{"role": "user", "content": "卫生间防水要刷多高"}]}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["sources"], "expected non-empty sources"
    assert any("防水" in source["source"] for source in body["sources"])
    assert fake_provider.received is not None
    system_message = fake_provider.received[0]
    assert system_message.role == "system"
    assert "1.8" in system_message.content  # retrieved doc text was injected
